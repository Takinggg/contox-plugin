import * as fs from 'fs';
import * as path from 'path';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Marker-based injection into AI rule files
 *
 * Injects a Contox section between <!-- contox:start --> and <!-- contox:end -->
 * markers. User content outside the markers is NEVER touched.
 *
 * Supported AI tools:
 *   - Cursor       → .cursorrules
 *   - Copilot      → .github/copilot-instructions.md
 *   - Windsurf     → .windsurfrules
 *   - Cline        → .clinerules
 *   - Claude Code  → CLAUDE.md (skipped — handled by MCP server)
 * ═══════════════════════════════════════════════════════════════════════════════ */

const MARKER_START = '<!-- contox:start -->';
const MARKER_END = '<!-- contox:end -->';

/** The instruction block injected into each AI's rule file */
const CONTOX_INSTRUCTIONS = `# Contox — Project Memory

You have access to a persistent project memory that survives across sessions.
The file \`.contox/memory.md\` in this workspace contains architecture decisions,
conventions, implementation history, bug fixes, and todos from all previous sessions.

## MANDATORY: Read memory at session start
- Read \`.contox/memory.md\` BEFORE starting any work
- This is your primary source of truth about this project
- Do NOT ask questions that are already answered in the memory

## Save your work at session end
- Run: \`contox save "Brief summary of what you did"\`
- For structured saves: \`echo '{"summary":"...","changes":[{"category":"implementation","title":"...","content":"..."}]}' | contox save --json\`
- Categories: architecture, conventions, implementation, decisions, bugs, todo`;

interface RuleTarget {
  name: string;
  relPath: string;
  /** Also inject if this directory exists (even if the file doesn't) */
  dirHint?: string;
}

const TARGETS: RuleTarget[] = [
  { name: 'Cursor', relPath: '.cursorrules', dirHint: '.cursor' },
  { name: 'Copilot', relPath: path.join('.github', 'copilot-instructions.md'), dirHint: '.github' },
  { name: 'Windsurf', relPath: '.windsurfrules' },
  { name: 'Cline', relPath: '.clinerules' },
];

/**
 * Merge the Contox section into existing file content.
 * If markers already exist → replace between them.
 * If no markers → append at the end.
 * If file is empty → return just the section.
 */
function mergeSection(existing: string, section: string): string {
  const wrapped = `${MARKER_START}\n${section}\n${MARKER_END}`;

  if (!existing.trim()) {
    return wrapped + '\n';
  }

  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + MARKER_END.length);
    return before + wrapped + after;
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return existing + separator + wrapped + '\n';
}

/**
 * Inject Contox instructions into all detected AI rule files.
 * Returns the list of AI tool names that were injected.
 */
export function injectAllRuleFiles(rootPath: string): string[] {
  const injected: string[] = [];

  for (const target of TARGETS) {
    const filePath = path.join(rootPath, target.relPath);
    const fileExists = fs.existsSync(filePath);
    const dirExists = target.dirHint
      ? fs.existsSync(path.join(rootPath, target.dirHint))
      : false;

    // Only inject if file exists OR its hint directory exists
    if (!fileExists && !dirExists) {
      continue;
    }

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const existing = fileExists ? fs.readFileSync(filePath, 'utf-8') : '';
      const merged = mergeSection(existing, CONTOX_INSTRUCTIONS);
      fs.writeFileSync(filePath, merged, 'utf-8');
      injected.push(target.name);
    } catch {
      // Non-critical — skip this target
    }
  }

  return injected;
}
