/* ═══════════════════════════════════════════════════════════════════════════════
 * Golden Set — Evaluation questions with expected answers
 *
 * Each question targets a specific schemaKey or set of schemaKeys.
 * Used by eval-runner.ts to measure recall@k, precision, and latency.
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface GoldenQuestion {
  /** Unique question ID */
  id: string;
  /** Natural language question */
  question: string;
  /** Schema keys that MUST appear in the answer */
  expectedSchemaKeys: string[];
  /** Keywords that SHOULD appear in the retrieved content */
  expectedKeywords: string[];
  /** Category for grouping results */
  category: 'architecture' | 'api' | 'frontend' | 'backend' | 'conventions' | 'bugs' | 'packages' | 'general';
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
}

export const GOLDEN_SET: GoldenQuestion[] = [
  // ─── Architecture / Stack ──────────────────────────────────────────────
  {
    id: 'arch-01',
    question: 'What tech stack does this project use?',
    expectedSchemaKeys: ['root/stack'],
    expectedKeywords: ['Next.js', 'TypeScript', 'Tailwind', 'Appwrite'],
    category: 'architecture',
    difficulty: 'easy',
  },
  {
    id: 'arch-02',
    question: 'What database does the project use?',
    expectedSchemaKeys: ['root/stack', 'root/stack/database'],
    expectedKeywords: ['Appwrite', 'collection', 'database'],
    category: 'architecture',
    difficulty: 'easy',
  },
  {
    id: 'arch-03',
    question: 'How is the project deployed?',
    expectedSchemaKeys: ['root/stack/deployment'],
    expectedKeywords: ['deploy', 'CI', 'hosting'],
    category: 'architecture',
    difficulty: 'medium',
  },
  {
    id: 'arch-04',
    question: 'What environment variables are needed?',
    expectedSchemaKeys: ['root/stack/environment'],
    expectedKeywords: ['env', 'config', 'variable'],
    category: 'architecture',
    difficulty: 'medium',
  },
  {
    id: 'arch-05',
    question: 'What design patterns are used in this codebase?',
    expectedSchemaKeys: ['root/stack', 'root/conventions'],
    expectedKeywords: ['pattern'],
    category: 'architecture',
    difficulty: 'medium',
  },

  // ─── API Surface ───────────────────────────────────────────────────────
  {
    id: 'api-01',
    question: 'How does user authentication work?',
    expectedSchemaKeys: ['root/api/auth'],
    expectedKeywords: ['auth', 'session', 'token', 'login'],
    category: 'api',
    difficulty: 'easy',
  },
  {
    id: 'api-02',
    question: 'What API endpoints exist for contexts?',
    expectedSchemaKeys: ['root/api/core'],
    expectedKeywords: ['context', 'GET', 'POST', 'PATCH', 'DELETE'],
    category: 'api',
    difficulty: 'easy',
  },
  {
    id: 'api-03',
    question: 'How does the brain API endpoint work?',
    expectedSchemaKeys: ['root/api/core'],
    expectedKeywords: ['brain', 'ETag', 'tier'],
    category: 'api',
    difficulty: 'medium',
  },
  {
    id: 'api-04',
    question: 'How does the populate endpoint work?',
    expectedSchemaKeys: ['root/api/core'],
    expectedKeywords: ['populate', 'schemaKey', 'draft', 'dryRun'],
    category: 'api',
    difficulty: 'medium',
  },
  {
    id: 'api-05',
    question: 'What integrations does the project support?',
    expectedSchemaKeys: ['root/api/integrations'],
    expectedKeywords: ['Slack', 'VS Code', 'integration'],
    category: 'api',
    difficulty: 'easy',
  },
  {
    id: 'api-06',
    question: 'How does the search API work?',
    expectedSchemaKeys: ['root/api/core'],
    expectedKeywords: ['search', 'query', 'content'],
    category: 'api',
    difficulty: 'medium',
  },
  {
    id: 'api-07',
    question: 'How do context entries work?',
    expectedSchemaKeys: ['root/api/core'],
    expectedKeywords: ['entry', 'ULID', 'idempotency', 'journal'],
    category: 'api',
    difficulty: 'medium',
  },
  {
    id: 'api-08',
    question: 'How does the billing system work?',
    expectedSchemaKeys: ['root/api/core', 'root/backend/integrations'],
    expectedKeywords: ['billing', 'Stripe', 'checkout', 'subscription'],
    category: 'api',
    difficulty: 'hard',
  },

  // ─── Frontend ──────────────────────────────────────────────────────────
  {
    id: 'fe-01',
    question: 'What UI components are available?',
    expectedSchemaKeys: ['root/frontend/ui'],
    expectedKeywords: ['component', 'Button', 'Card'],
    category: 'frontend',
    difficulty: 'easy',
  },
  {
    id: 'fe-02',
    question: 'What pages does the dashboard have?',
    expectedSchemaKeys: ['root/frontend/pages'],
    expectedKeywords: ['dashboard', 'settings', 'contexts', 'projects'],
    category: 'frontend',
    difficulty: 'easy',
  },
  {
    id: 'fe-03',
    question: 'What custom hooks does the project use?',
    expectedSchemaKeys: ['root/frontend/hooks'],
    expectedKeywords: ['hook', 'use'],
    category: 'frontend',
    difficulty: 'medium',
  },
  {
    id: 'fe-04',
    question: 'What are the design system tokens and colors?',
    expectedSchemaKeys: ['root/frontend/design'],
    expectedKeywords: ['color', 'orange', 'dark', 'theme'],
    category: 'frontend',
    difficulty: 'medium',
  },
  {
    id: 'fe-05',
    question: 'How does the landing page work?',
    expectedSchemaKeys: ['root/frontend/pages'],
    expectedKeywords: ['landing', 'component', 'scroll'],
    category: 'frontend',
    difficulty: 'medium',
  },
  {
    id: 'fe-06',
    question: 'How does the StatsCard component work?',
    expectedSchemaKeys: ['root/frontend/ui'],
    expectedKeywords: ['StatsCard', 'label', 'change'],
    category: 'frontend',
    difficulty: 'hard',
  },
  {
    id: 'fe-07',
    question: 'What routing structure does the app use?',
    expectedSchemaKeys: ['root/frontend/pages'],
    expectedKeywords: ['route', 'app', 'dashboard', 'login'],
    category: 'frontend',
    difficulty: 'easy',
  },
  {
    id: 'fe-08',
    question: 'How do scroll animations work?',
    expectedSchemaKeys: ['root/frontend/hooks'],
    expectedKeywords: ['scroll', 'animation', 'IntersectionObserver', 'useScrollAnimation'],
    category: 'frontend',
    difficulty: 'hard',
  },

  // ─── Backend ───────────────────────────────────────────────────────────
  {
    id: 'be-01',
    question: 'How does authentication middleware work?',
    expectedSchemaKeys: ['root/backend/auth'],
    expectedKeywords: ['auth', 'middleware', 'token', 'session'],
    category: 'backend',
    difficulty: 'easy',
  },
  {
    id: 'be-02',
    question: 'How does RBAC work in this project?',
    expectedSchemaKeys: ['root/backend/auth'],
    expectedKeywords: ['role', 'permission', 'owner', 'admin', 'member'],
    category: 'backend',
    difficulty: 'medium',
  },
  {
    id: 'be-03',
    question: 'What external services does the backend integrate with?',
    expectedSchemaKeys: ['root/backend/integrations'],
    expectedKeywords: ['Stripe', 'Appwrite', 'integration'],
    category: 'backend',
    difficulty: 'easy',
  },
  {
    id: 'be-04',
    question: 'How does optimistic concurrency control work?',
    expectedSchemaKeys: ['root/backend/logic', 'root/stack'],
    expectedKeywords: ['OCC', 'version', '409', 'conflict'],
    category: 'backend',
    difficulty: 'hard',
  },
  {
    id: 'be-05',
    question: 'How does the content hash mechanism work?',
    expectedSchemaKeys: ['root/backend/logic'],
    expectedKeywords: ['contentHash', 'SHA-256', 'skip', 'idempotent'],
    category: 'backend',
    difficulty: 'hard',
  },
  {
    id: 'be-06',
    question: 'How does the mutation audit log work?',
    expectedSchemaKeys: ['root/backend/logic', 'root/stack/database'],
    expectedKeywords: ['mutation', 'audit', 'context_mutations', 'oldHash', 'newHash'],
    category: 'backend',
    difficulty: 'hard',
  },

  // ─── Conventions ───────────────────────────────────────────────────────
  {
    id: 'conv-01',
    question: 'What coding conventions does the project follow?',
    expectedSchemaKeys: ['root/conventions'],
    expectedKeywords: ['convention', 'style', 'ESLint'],
    category: 'conventions',
    difficulty: 'easy',
  },
  {
    id: 'conv-02',
    question: 'What ESLint rules are enforced?',
    expectedSchemaKeys: ['root/conventions'],
    expectedKeywords: ['ESLint', 'strict', 'void', 'arrow'],
    category: 'conventions',
    difficulty: 'medium',
  },
  {
    id: 'conv-03',
    question: 'What naming patterns are used?',
    expectedSchemaKeys: ['root/conventions'],
    expectedKeywords: ['naming', 'pattern', 'convention'],
    category: 'conventions',
    difficulty: 'medium',
  },

  // ─── Bugs ──────────────────────────────────────────────────────────────
  {
    id: 'bug-01',
    question: 'What bugs have been found and fixed?',
    expectedSchemaKeys: ['root/bugs'],
    expectedKeywords: ['bug', 'fix'],
    category: 'bugs',
    difficulty: 'easy',
  },
  {
    id: 'bug-02',
    question: 'Were there any issues with undefined content?',
    expectedSchemaKeys: ['root/bugs'],
    expectedKeywords: ['undefined', 'content', 'null'],
    category: 'bugs',
    difficulty: 'medium',
  },
  {
    id: 'bug-03',
    question: 'What edge cases have been discovered?',
    expectedSchemaKeys: ['root/bugs'],
    expectedKeywords: ['edge case', 'workaround'],
    category: 'bugs',
    difficulty: 'medium',
  },

  // ─── Packages ──────────────────────────────────────────────────────────
  {
    id: 'pkg-01',
    question: 'How does the MCP server work?',
    expectedSchemaKeys: ['root/packages/mcp'],
    expectedKeywords: ['MCP', 'tool', 'server', 'memory'],
    category: 'packages',
    difficulty: 'easy',
  },
  {
    id: 'pkg-02',
    question: 'What MCP tools are available?',
    expectedSchemaKeys: ['root/packages/mcp'],
    expectedKeywords: ['contox_get_memory', 'contox_save_session', 'tool'],
    category: 'packages',
    difficulty: 'easy',
  },
  {
    id: 'pkg-03',
    question: 'How does the CLI work?',
    expectedSchemaKeys: ['root/packages/cli'],
    expectedKeywords: ['CLI', 'command', 'contox'],
    category: 'packages',
    difficulty: 'easy',
  },
  {
    id: 'pkg-04',
    question: 'How does the Claude plugin work?',
    expectedSchemaKeys: ['root/packages/plugin'],
    expectedKeywords: ['plugin', 'Claude', 'marketplace'],
    category: 'packages',
    difficulty: 'medium',
  },
  {
    id: 'pkg-05',
    question: 'How does the VS Code extension work?',
    expectedSchemaKeys: ['root/packages/vscode'],
    expectedKeywords: ['VS Code', 'extension', 'vscode'],
    category: 'packages',
    difficulty: 'medium',
  },
  {
    id: 'pkg-06',
    question: 'How does the brain populator work?',
    expectedSchemaKeys: ['root/packages/mcp'],
    expectedKeywords: ['populate', 'brain', 'scanner', 'draft'],
    category: 'packages',
    difficulty: 'hard',
  },
  {
    id: 'pkg-07',
    question: 'How does session saving work in the MCP server?',
    expectedSchemaKeys: ['root/packages/mcp'],
    expectedKeywords: ['session', 'save', 'category', 'entry', 'schemaKey'],
    category: 'packages',
    difficulty: 'medium',
  },

  // ─── General / Cross-cutting ───────────────────────────────────────────
  {
    id: 'gen-01',
    question: 'What is the brain schema hierarchy?',
    expectedSchemaKeys: ['root', 'root/stack'],
    expectedKeywords: ['brain', 'schema', 'tier', 'schemaKey', 'hierarchy'],
    category: 'general',
    difficulty: 'medium',
  },
  {
    id: 'gen-02',
    question: 'How does the tier system work?',
    expectedSchemaKeys: ['root/stack'],
    expectedKeywords: ['tier', '1', '2', '3', 'always loaded', 'on-demand'],
    category: 'general',
    difficulty: 'medium',
  },
  {
    id: 'gen-03',
    question: 'How does the state machine work for contexts?',
    expectedSchemaKeys: ['root/stack', 'root/decisions'],
    expectedKeywords: ['draft', 'approved', 'deprecated', 'state'],
    category: 'general',
    difficulty: 'hard',
  },
  {
    id: 'gen-04',
    question: 'What is the difference between content and entries storage models?',
    expectedSchemaKeys: ['root/stack', 'root/decisions'],
    expectedKeywords: ['content', 'entries', 'event-sourced', 'curated'],
    category: 'general',
    difficulty: 'hard',
  },
  {
    id: 'gen-05',
    question: 'How are write policies enforced?',
    expectedSchemaKeys: ['root/backend/auth', 'root/conventions'],
    expectedKeywords: ['writePolicy', 'mcp', 'scanner', 'both', 'ui'],
    category: 'general',
    difficulty: 'hard',
  },
  {
    id: 'gen-06',
    question: 'What pending tasks or TODOs exist?',
    expectedSchemaKeys: ['root/todo'],
    expectedKeywords: ['todo', 'pending', 'task'],
    category: 'general',
    difficulty: 'easy',
  },
  {
    id: 'gen-07',
    question: 'What architectural decisions have been made?',
    expectedSchemaKeys: ['root/decisions'],
    expectedKeywords: ['decision', 'rationale', 'trade-off'],
    category: 'general',
    difficulty: 'easy',
  },
  {
    id: 'gen-08',
    question: 'How does idempotency work for entries?',
    expectedSchemaKeys: ['root/backend/logic', 'root/api/core'],
    expectedKeywords: ['idempotency', 'idempotencyKey', 'hash', 'retry'],
    category: 'general',
    difficulty: 'hard',
  },
  {
    id: 'gen-09',
    question: 'How does the ETag caching mechanism work?',
    expectedSchemaKeys: ['root/api/core', 'root/backend/logic'],
    expectedKeywords: ['ETag', '304', 'brainHash', 'brainRevision', 'If-None-Match'],
    category: 'general',
    difficulty: 'hard',
  },
  {
    id: 'gen-10',
    question: 'How do context links work?',
    expectedSchemaKeys: ['root/api/core', 'root/stack/database'],
    expectedKeywords: ['link', 'see-also', 'depends-on', 'graph', 'cross-reference'],
    category: 'general',
    difficulty: 'medium',
  },
];
