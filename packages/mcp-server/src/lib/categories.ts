/* ═══════════════════════════════════════════════════════════════════════════════
 * Context Categories — Defines how session data is organized into sub-contexts
 *
 * Each category becomes a sub-context under the project's root "Project Memory"
 * context. Claude structures its save_session call using these categories.
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface ContextCategory {
  /** Unique slug used as identifier */
  id: string;
  /** Display name for the sub-context */
  name: string;
  /** Description shown to the AI */
  description: string;
  /** Order in the memory document (lower = first) */
  order: number;
}

/**
 * Pre-defined categories for organizing project memory.
 * These map 1:1 to sub-contexts under the root "Project Memory" context.
 */
export const CATEGORIES: ContextCategory[] = [
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'Tech stack, architecture decisions, design patterns, project structure, infrastructure',
    order: 0,
  },
  {
    id: 'conventions',
    name: 'Conventions & Rules',
    description: 'Coding conventions, style rules, linter gotchas, naming patterns, team agreements',
    order: 1,
  },
  {
    id: 'implementation',
    name: 'Implementation Log',
    description: 'Features built, components created, APIs implemented, integrations added',
    order: 2,
  },
  {
    id: 'decisions',
    name: 'Technical Decisions',
    description: 'Key decisions with rationale: why X over Y, trade-offs considered, constraints',
    order: 3,
  },
  {
    id: 'bugs',
    name: 'Bugs & Fixes',
    description: 'Bugs found and how they were fixed, edge cases discovered, workarounds applied',
    order: 4,
  },
  {
    id: 'todo',
    name: 'Todo & Next Steps',
    description: 'Pending tasks, known issues, planned improvements, tech debt to address',
    order: 5,
  },
  {
    id: 'sessions',
    name: 'Session Log',
    description: 'Chronological log of all AI sessions with date and summary',
    order: 6,
  },
];

/** Root context name */
export const ROOT_CONTEXT_NAME = 'Project Memory';
export const ROOT_CONTEXT_DESC = 'Root context for AI project memory — contains all sub-contexts';

/** Build the sub-context name from category */
export function subContextName(category: ContextCategory): string {
  return `[Memory] ${category.name}`;
}

/** Find a category by its id */
export function findCategory(id: string): ContextCategory | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
