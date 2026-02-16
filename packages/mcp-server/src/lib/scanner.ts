import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Project Scanner — walks the codebase and extracts structure + source code
 * signatures for AI consumption. Respects .gitignore and skips binary/large files.
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface ScanResult {
  root: string;
  tree: string[];
  packageJson: Record<string, unknown> | null;
  tsConfig: Record<string, unknown> | null;
  envExample: string | null;
  routes: RouteInfo[];
  components: ComponentInfo[];
  libs: LibInfo[];
  hooks: LibInfo[];
  stores: LibInfo[];
  middlewares: LibInfo[];
  keyFiles: KeyFile[];
  stats: {
    totalFiles: number;
    totalDirs: number;
    languages: Record<string, number>;
  };
}

export interface RouteInfo {
  path: string;
  methods: string[];
  filePath: string;
  schemas: string[];
  middleware: string[];
}

export interface ComponentInfo {
  name: string;
  filePath: string;
  props: string | null;
  description: string | null;
}

export interface LibInfo {
  filePath: string;
  exports: ExportInfo[];
  description: string | null;
}

export interface ExportInfo {
  name: string;
  signature: string;
  kind: 'function' | 'const' | 'class' | 'type' | 'interface';
}

export interface KeyFile {
  path: string;
  content: string;
  reason: string;
}

// Directories to always skip
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'out', 'build', '.cache',
  '.turbo', 'coverage', '.nyc_output', '.storybook', 'storybook-static',
  '__pycache__', '.venv', 'vendor', '.svn', '.hg',
  'test-results', 'playwright-report', '.playwright',
]);

// Files to always skip
const SKIP_FILES = new Set([
  'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
  '.DS_Store', 'Thumbs.db', 'nul',
]);

// Binary extensions to skip
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.wav', '.ogg', '.webm',
  '.zip', '.tar', '.gz', '.br', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib', '.wasm',
  '.map',
]);

// Max file size to read (32 KB)
const MAX_FILE_SIZE = 32 * 1024;

// Key file patterns — files that are always included in the context
const KEY_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /^README\.md$/i, reason: 'Project documentation' },
  { pattern: /^ARCHITECTURE\.md$/i, reason: 'Architecture documentation' },
  { pattern: /^CLAUDE\.md$/i, reason: 'AI assistant instructions' },
  { pattern: /^AGENTS\.md$/i, reason: 'AI agent instructions' },
  { pattern: /^RULES\.md$/i, reason: 'Project rules' },
  { pattern: /^CONTRIBUTING\.md$/i, reason: 'Contribution guidelines' },
  { pattern: /^\.cursorrules$/i, reason: 'AI assistant rules' },
  { pattern: /^\.clinerules$/i, reason: 'AI assistant rules' },
  { pattern: /^Dockerfile$/i, reason: 'Container configuration' },
  { pattern: /^docker-compose\.ya?ml$/i, reason: 'Container orchestration' },
  { pattern: /^\.env\.example$/i, reason: 'Environment template' },
  { pattern: /^schema\.prisma$/i, reason: 'Database schema' },
  { pattern: /^drizzle\.config\.\w+$/i, reason: 'Database configuration' },
];

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith('.');
}

function shouldSkipFile(name: string): boolean {
  if (SKIP_FILES.has(name)) return true;
  const ext = extname(name).toLowerCase();
  if (BINARY_EXT.has(ext)) return true;
  return false;
}

function isKeyFile(name: string): { match: boolean; reason: string } {
  for (const { pattern, reason } of KEY_FILE_PATTERNS) {
    if (pattern.test(name)) {
      return { match: true, reason };
    }
  }
  return { match: false, reason: '' };
}

function getLanguage(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript (JSX)',
    '.js': 'JavaScript', '.jsx': 'JavaScript (JSX)',
    '.py': 'Python', '.rb': 'Ruby', '.go': 'Go',
    '.rs': 'Rust', '.java': 'Java', '.kt': 'Kotlin',
    '.swift': 'Swift', '.cs': 'C#', '.cpp': 'C++',
    '.c': 'C', '.php': 'PHP', '.vue': 'Vue',
    '.svelte': 'Svelte', '.astro': 'Astro',
    '.css': 'CSS', '.scss': 'SCSS', '.less': 'LESS',
    '.html': 'HTML', '.md': 'Markdown',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML',
    '.toml': 'TOML', '.xml': 'XML',
    '.sql': 'SQL', '.graphql': 'GraphQL', '.gql': 'GraphQL',
    '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
    '.dockerfile': 'Dockerfile',
  };
  return map[ext] ?? null;
}

/* ── Source Code Extraction ─────────────────────────────────────────────── */

/**
 * Extract HTTP methods and middleware from a Next.js route file.
 */
function extractRouteInfo(content: string, routePath: string, filePath: string): RouteInfo {
  const methods: string[] = [];
  const schemas: string[] = [];
  const middleware: string[] = [];

  // Find exported HTTP methods
  const methodPattern = /export\s+(?:const|function)\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/g;
  let match;
  while ((match = methodPattern.exec(content)) !== null) {
    methods.push(match[1]!);
  }

  // Also detect wrapped handlers: export const GET = withRateLimit(handleGet)
  const wrappedPattern = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*=\s*(\w+)\(/g;
  while ((match = wrappedPattern.exec(content)) !== null) {
    if (!methods.includes(match[1]!)) {
      methods.push(match[1]!);
    }
    middleware.push(match[2]!);
  }

  // Extract Zod schemas
  const schemaPattern = /(?:const|let)\s+(\w+Schema)\s*=\s*z\.\w+\(\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\)/g;
  while ((match = schemaPattern.exec(content)) !== null) {
    const schemaName = match[1]!;
    const schemaBody = match[2]!;
    // Clean up and truncate
    const cleaned = schemaBody.replace(/\s+/g, ' ').trim();
    schemas.push(`${schemaName}: { ${cleaned.length > 200 ? cleaned.slice(0, 200) + '...' : cleaned} }`);
  }

  // Deduplicate middleware
  const uniqueMiddleware = [...new Set(middleware)];

  return { path: routePath, methods, filePath, schemas, middleware: uniqueMiddleware };
}

/**
 * Extract component name and props from a React component file.
 */
function extractComponentInfo(content: string, filePath: string): ComponentInfo {
  let name = basename(filePath).replace(/\.(tsx|jsx)$/, '');
  let props: string | null = null;
  let description: string | null = null;

  // Find the exported component name
  const defaultExport = content.match(/export\s+default\s+function\s+(\w+)/);
  const namedExport = content.match(/export\s+function\s+(\w+)/);
  if (defaultExport) {
    name = defaultExport[1]!;
  } else if (namedExport) {
    name = namedExport[1]!;
  }

  // Extract Props interface/type
  const propsPatterns = [
    // interface FooProps { ... }
    /(?:export\s+)?interface\s+(\w*Props\w*)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/,
    // type FooProps = { ... }
    /(?:export\s+)?type\s+(\w*Props\w*)\s*=\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/,
  ];

  for (const pattern of propsPatterns) {
    const propsMatch = content.match(pattern);
    if (propsMatch) {
      const propsBody = propsMatch[2]!.trim();
      // Extract property names and types
      const propLines = propsBody.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('//') && !line.startsWith('/*'));
      if (propLines.length > 0) {
        props = propLines.slice(0, 15).join('\n');
        if (propLines.length > 15) {
          props += `\n// ... ${String(propLines.length - 15)} more props`;
        }
      }
      break;
    }
  }

  // Extract JSDoc or leading comment as description
  const jsdocMatch = content.match(/\/\*\*\s*\n([^*]*(?:\*[^/][^*]*)*)\*\/\s*\n\s*(?:export\s+)?(?:default\s+)?function/);
  if (jsdocMatch) {
    description = jsdocMatch[1]!
      .replace(/^\s*\*\s?/gm, '')
      .trim()
      .split('\n')[0] ?? null;
  }

  return { name, filePath, props, description };
}

/**
 * Extract exported functions, types, and constants from a TypeScript module.
 */
function extractLibInfo(content: string, filePath: string): LibInfo {
  const exports: ExportInfo[] = [];
  let description: string | null = null;

  // Extract module-level JSDoc
  const moduleDoc = content.match(/^\/\*\*\s*\n([^*]*(?:\*[^/][^*]*)*)\*\/\s*\n/);
  if (moduleDoc) {
    description = moduleDoc[1]!
      .replace(/^\s*\*\s?/gm, '')
      .trim()
      .split('\n')[0] ?? null;
  }

  // Exported functions: export function foo(...): ReturnType
  const funcPattern = /export\s+(async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*)\)\s*:\s*([^\n{]+)/g;
  let match;
  while ((match = funcPattern.exec(content)) !== null) {
    const isAsync = match[1] ? 'async ' : '';
    const name = match[2]!;
    const generics = match[3] ?? '';
    const params = match[4]!.replace(/\s+/g, ' ').trim();
    const returnType = match[5]!.trim().replace(/\s*\{$/, '');
    exports.push({
      name,
      signature: `${isAsync}function ${name}${generics}(${params}): ${returnType}`,
      kind: 'function',
    });
  }

  // Exported arrow functions: export const foo = (...) => ... or export const foo = async (...) =>
  const arrowPattern = /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(async\s+)?\(([^)]*)\)\s*(?::\s*([^\n=>]+))?\s*=>/g;
  while ((match = arrowPattern.exec(content)) !== null) {
    const name = match[1]!;
    const isAsync = match[2] ? 'async ' : '';
    const params = match[3]!.replace(/\s+/g, ' ').trim();
    const returnType = match[4]?.trim() ?? 'unknown';
    // Skip if already found as a function export
    if (!exports.some(e => e.name === name)) {
      exports.push({
        name,
        signature: `${isAsync}const ${name} = (${params}): ${returnType}`,
        kind: 'function',
      });
    }
  }

  // Exported constants (non-function): export const FOO = value
  const constPattern = /export\s+const\s+(\w+)\s*(?::\s*([^=\n]+))?\s*=/g;
  while ((match = constPattern.exec(content)) !== null) {
    const name = match[1]!;
    const type = match[2]?.trim();
    if (!exports.some(e => e.name === name)) {
      exports.push({
        name,
        signature: type ? `const ${name}: ${type}` : `const ${name}`,
        kind: 'const',
      });
    }
  }

  // Exported interfaces
  const interfacePattern = /export\s+interface\s+(\w+)\s*(?:<[^>]*>)?\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  while ((match = interfacePattern.exec(content)) !== null) {
    const name = match[1]!;
    const body = match[2]!.trim();
    const fields = body.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
    const preview = fields.slice(0, 8).join('; ');
    exports.push({
      name,
      signature: `interface ${name} { ${preview}${fields.length > 8 ? '; ...' : ''} }`,
      kind: 'interface',
    });
  }

  // Exported types
  const typePattern = /export\s+type\s+(\w+)\s*(?:<[^>]*>)?\s*=\s*([^\n;]+)/g;
  while ((match = typePattern.exec(content)) !== null) {
    const name = match[1]!;
    const value = match[2]!.trim();
    exports.push({
      name,
      signature: `type ${name} = ${value.length > 100 ? value.slice(0, 100) + '...' : value}`,
      kind: 'type',
    });
  }

  // Exported classes
  const classPattern = /export\s+(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(\w+))?/g;
  while ((match = classPattern.exec(content)) !== null) {
    const name = match[1]!;
    const ext = match[2] ? ` extends ${match[2]}` : '';
    const impl = match[3] ? ` implements ${match[3]}` : '';
    exports.push({
      name,
      signature: `class ${name}${ext}${impl}`,
      kind: 'class',
    });
  }

  return { filePath, exports, description };
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export function scanProject(rootDir: string): ScanResult {
  const tree: string[] = [];
  const routes: RouteInfo[] = [];
  const components: ComponentInfo[] = [];
  const libs: LibInfo[] = [];
  const hooks: LibInfo[] = [];
  const stores: LibInfo[] = [];
  const middlewares: LibInfo[] = [];
  const keyFiles: KeyFile[] = [];
  const languages: Record<string, number> = {};
  let totalFiles = 0;
  let totalDirs = 0;

  function walk(dir: string, depth: number): void {
    if (depth > 8) return; // prevent infinite recursion

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    // Sort: dirs first, then files
    const sorted = entries.sort((a, b) => {
      const aIsDir = safeIsDir(join(dir, a));
      const bIsDir = safeIsDir(join(dir, b));
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (const entry of sorted) {
      const fullPath = join(dir, entry);
      const relPath = relative(rootDir, fullPath).replace(/\\/g, '/');

      if (safeIsDir(fullPath)) {
        if (shouldSkipDir(entry)) continue;
        totalDirs++;
        tree.push(relPath + '/');
        walk(fullPath, depth + 1);
      } else {
        if (shouldSkipFile(entry)) continue;
        totalFiles++;
        tree.push(relPath);

        // Track languages
        const lang = getLanguage(entry);
        if (lang) {
          languages[lang] = (languages[lang] ?? 0) + 1;
        }

        // Detect Next.js routes — read source for methods/schemas
        if (relPath.startsWith('src/app/') && (entry === 'page.tsx' || entry === 'route.ts')) {
          const routePath = relPath
            .replace('src/app', '')
            .replace('/page.tsx', '')
            .replace('/route.ts', '')
            .replace(/\/\[([^\]]+)\]/g, '/:$1');

          if (entry === 'route.ts') {
            const content = safeRead(fullPath);
            if (content && !content.startsWith('[File too large')) {
              routes.push(extractRouteInfo(content, routePath || '/', relPath));
            } else {
              routes.push({ path: routePath || '/', methods: [], filePath: relPath, schemas: [], middleware: [] });
            }
          } else {
            // page.tsx — it's a page route, method is always GET
            routes.push({ path: routePath || '/', methods: ['PAGE'], filePath: relPath, schemas: [], middleware: [] });
          }
        }

        // Detect components — read source for props
        if (relPath.match(/src\/components\/.*\.(tsx|jsx)$/) && !relPath.includes('.test.') && !relPath.includes('.stories.')) {
          const content = safeRead(fullPath);
          if (content && !content.startsWith('[File too large')) {
            components.push(extractComponentInfo(content, relPath));
          } else {
            components.push({ name: basename(relPath).replace(/\.(tsx|jsx)$/, ''), filePath: relPath, props: null, description: null });
          }
        }

        // Detect hooks — read source for signatures
        if (relPath.match(/src\/hooks\/.*\.(ts|js)$/) && !relPath.includes('.test.')) {
          const content = safeRead(fullPath);
          if (content && !content.startsWith('[File too large')) {
            hooks.push(extractLibInfo(content, relPath));
          }
        }

        // Detect stores — read source for signatures
        if (relPath.match(/src\/stores\/.*\.(ts|js)$/) && !relPath.includes('.test.')) {
          const content = safeRead(fullPath);
          if (content && !content.startsWith('[File too large')) {
            stores.push(extractLibInfo(content, relPath));
          }
        }

        // Detect middleware
        if (relPath === 'src/middleware.ts' || relPath === 'middleware.ts') {
          const content = safeRead(fullPath);
          if (content && !content.startsWith('[File too large')) {
            middlewares.push(extractLibInfo(content, relPath));
          }
        }

        // Detect lib files — read source for signatures
        if (relPath.match(/src\/lib\/.*\.(ts|js)$/) && !relPath.includes('.test.')) {
          const content = safeRead(fullPath);
          if (content && !content.startsWith('[File too large')) {
            libs.push(extractLibInfo(content, relPath));
          } else {
            libs.push({ filePath: relPath, exports: [], description: null });
          }
        }

        // Check key files
        const key = isKeyFile(entry);
        if (key.match) {
          const content = safeRead(fullPath);
          if (content) {
            keyFiles.push({ path: relPath, content, reason: key.reason });
          }
        }
      }
    }
  }

  walk(rootDir, 0);

  // Read config files
  const packageJson = safeReadJson(join(rootDir, 'package.json'));
  const tsConfig = safeReadJson(join(rootDir, 'tsconfig.json'));
  const envExample = safeRead(join(rootDir, '.env.example'));

  return {
    root: rootDir,
    tree,
    packageJson,
    tsConfig,
    envExample,
    routes,
    components,
    libs,
    hooks,
    stores,
    middlewares,
    keyFiles,
    stats: { totalFiles, totalDirs, languages },
  };
}

function safeIsDir(p: string): boolean {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

function safeRead(p: string): string | null {
  try {
    if (!existsSync(p)) return null;
    const stat = statSync(p);
    if (stat.size > MAX_FILE_SIZE) return `[File too large: ${Math.round(stat.size / 1024)}KB]`;
    return readFileSync(p, 'utf-8');
  } catch { return null; }
}

function safeReadJson(p: string): Record<string, unknown> | null {
  const raw = safeRead(p);
  if (!raw || raw.startsWith('[File too large')) return null;
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
}
