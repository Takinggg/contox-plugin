/* ═══════════════════════════════════════════════════════════════════════════════
 * Brain Schema — Defines the hierarchical knowledge architecture
 *
 * Each node has a schemaKey, tier, contextType, storageModel, and writePolicy.
 * This is the source of truth for the brain structure.
 * ═══════════════════════════════════════════════════════════════════════════════ */

export type StorageModel = 'content' | 'entries';
export type WritePolicy = 'mcp' | 'ui' | 'both' | 'scanner';
export type ContextType = 'system' | 'reference' | 'memory';
export type Tier = 1 | 2 | 3;

export interface SchemaLink {
  toSchemaKey: string;
  linkType: string;
}

export interface BrainNode {
  schemaKey: string;
  name: string;
  contextType: ContextType;
  tier: Tier;
  order: number;
  description: string;
  storageModel: StorageModel;
  writePolicy: WritePolicy;
  children?: BrainNode[];
  links?: SchemaLink[];
}

/** Category ID → schemaKey mapping for backward compatibility */
export const CATEGORY_TO_SCHEMA_KEY: Record<string, string> = {
  architecture: 'root/stack',
  conventions: 'root/conventions',
  implementation: 'root/journal',
  decisions: 'root/decisions',
  bugs: 'root/bugs',
  todo: 'root/todo',
  sessions: 'root/sessions',
};

/** schemaKey → BrainNode lookup (flattened) */
const SCHEMA_KEY_MAP = new Map<string, BrainNode>();

export const BRAIN_SCHEMA: BrainNode = {
  schemaKey: 'root',
  name: 'Project Memory',
  contextType: 'system',
  tier: 1,
  order: 0,
  description: 'Root context — project overview and metadata',
  storageModel: 'content',
  writePolicy: 'mcp',
  children: [
    {
      schemaKey: 'root/cortex',
      name: 'Cortex',
      contextType: 'system',
      tier: 1,
      order: 1,
      description: 'Auto-generated project summary — current focus, recent sessions',
      storageModel: 'content',
      writePolicy: 'mcp',
    },
    {
      schemaKey: 'root/stack',
      name: 'Stack & Infrastructure',
      contextType: 'reference',
      tier: 1,
      order: 2,
      description: 'Tech stack, architecture decisions, design patterns, project structure',
      storageModel: 'content',
      writePolicy: 'both',
      children: [
        {
          schemaKey: 'root/stack/database',
          name: 'Database Schema',
          contextType: 'reference',
          tier: 2,
          order: 0,
          description: 'Database schema, collections, indexes, relationships',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/stack/environment',
          name: 'Environment & Config',
          contextType: 'reference',
          tier: 2,
          order: 1,
          description: 'Environment variables, configuration files, deployment settings',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/stack/deployment',
          name: 'Deployment & CI/CD',
          contextType: 'reference',
          tier: 2,
          order: 2,
          description: 'Deployment setup, CI/CD pipelines, hosting infrastructure',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
      ],
    },
    {
      schemaKey: 'root/api',
      name: 'API Surface',
      contextType: 'reference',
      tier: 1,
      order: 3,
      description: 'API endpoints, request/response schemas, authentication',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/backend/auth', linkType: 'see-also' },
        { toSchemaKey: 'root/stack/database', linkType: 'depends-on' },
      ],
      children: [
        {
          schemaKey: 'root/api/auth',
          name: 'Auth & User Endpoints',
          contextType: 'reference',
          tier: 2,
          order: 0,
          description: 'Authentication, registration, password reset, session management',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/api/core',
          name: 'Core Resource Endpoints',
          contextType: 'reference',
          tier: 2,
          order: 1,
          description: 'CRUD endpoints for core business entities',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/api/integrations',
          name: 'Integration Endpoints',
          contextType: 'reference',
          tier: 2,
          order: 2,
          description: 'Third-party integration endpoints (Slack, VS Code, etc.)',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
      ],
    },
    {
      schemaKey: 'root/frontend',
      name: 'Frontend Architecture',
      contextType: 'reference',
      tier: 1,
      order: 4,
      description: 'Frontend components, pages, hooks, design system',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/frontend/design', linkType: 'depends-on' },
        { toSchemaKey: 'root/api', linkType: 'see-also' },
      ],
      children: [
        {
          schemaKey: 'root/frontend/ui',
          name: 'UI Component Library',
          contextType: 'reference',
          tier: 2,
          order: 0,
          description: 'Reusable UI components, their props and usage patterns',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/frontend/pages',
          name: 'Page Components & Routes',
          contextType: 'reference',
          tier: 2,
          order: 1,
          description: 'Page-level components and routing structure',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/frontend/hooks',
          name: 'Hooks & State Management',
          contextType: 'reference',
          tier: 2,
          order: 2,
          description: 'Custom hooks, state management patterns, data fetching',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/frontend/design',
          name: 'Design System Tokens',
          contextType: 'reference',
          tier: 2,
          order: 3,
          description: 'Colors, typography, spacing, design tokens and variables',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
      ],
    },
    {
      schemaKey: 'root/backend',
      name: 'Backend Architecture',
      contextType: 'reference',
      tier: 1,
      order: 5,
      description: 'Backend modules, business logic, external integrations',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/stack/database', linkType: 'depends-on' },
        { toSchemaKey: 'root/api', linkType: 'see-also' },
      ],
      children: [
        {
          schemaKey: 'root/backend/auth',
          name: 'Auth & Security',
          contextType: 'reference',
          tier: 2,
          order: 0,
          description: 'Authentication middleware, RBAC, security patterns',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/backend/logic',
          name: 'Business Logic Modules',
          contextType: 'reference',
          tier: 2,
          order: 1,
          description: 'Core business logic, validation, data processing',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/backend/integrations',
          name: 'External Integrations',
          contextType: 'reference',
          tier: 2,
          order: 2,
          description: 'Third-party service integrations (Stripe, Appwrite, etc.)',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
      ],
    },
    {
      schemaKey: 'root/packages',
      name: 'Packages & Extensions',
      contextType: 'reference',
      tier: 1,
      order: 6,
      description: 'MCP server, CLI, Claude plugin, VS Code extension',
      storageModel: 'content',
      writePolicy: 'scanner',
      children: [
        {
          schemaKey: 'root/packages/mcp',
          name: 'MCP Server Package',
          contextType: 'reference',
          tier: 2,
          order: 0,
          description: 'MCP server implementation, tools, API client',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/packages/cli',
          name: 'CLI Package',
          contextType: 'reference',
          tier: 2,
          order: 1,
          description: 'CLI commands, options, configuration',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/packages/plugin',
          name: 'Claude Plugin Package',
          contextType: 'reference',
          tier: 2,
          order: 2,
          description: 'Claude Code plugin configuration and marketplace metadata',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/packages/vscode',
          name: 'VS Code Extension',
          contextType: 'reference',
          tier: 2,
          order: 3,
          description: 'VS Code extension functionality and configuration',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
      ],
    },
    {
      schemaKey: 'root/conventions',
      name: 'Conventions & Patterns',
      contextType: 'memory',
      tier: 1,
      order: 7,
      description: 'Coding conventions, style rules, naming patterns, team agreements',
      storageModel: 'entries',
      writePolicy: 'both',
    },
    {
      schemaKey: 'root/decisions',
      name: 'Architecture Decisions',
      contextType: 'memory',
      tier: 1,
      order: 8,
      description: 'Key decisions with rationale: why X over Y, trade-offs, constraints',
      storageModel: 'entries',
      writePolicy: 'both',
    },
    {
      schemaKey: 'root/todo',
      name: 'Active Todo & Roadmap',
      contextType: 'memory',
      tier: 1,
      order: 9,
      description: 'Pending tasks, known issues, planned improvements, tech debt',
      storageModel: 'entries',
      writePolicy: 'both',
    },
    {
      schemaKey: 'root/bugs',
      name: 'Bug Registry',
      contextType: 'memory',
      tier: 1,
      order: 10,
      description: 'Bugs found and how they were fixed, edge cases, workarounds',
      storageModel: 'entries',
      writePolicy: 'mcp',
    },
    {
      schemaKey: 'root/journal',
      name: 'Implementation Journal',
      contextType: 'memory',
      tier: 2,
      order: 11,
      description: 'Features built, components created, APIs implemented',
      storageModel: 'entries',
      writePolicy: 'mcp',
    },
    {
      schemaKey: 'root/sessions',
      name: 'Session Chronicle',
      contextType: 'system',
      tier: 2,
      order: 12,
      description: 'Chronological log of all AI sessions with date and summary',
      storageModel: 'entries',
      writePolicy: 'mcp',
    },
    // ── Engineering Layers ──────────────────────────────────────────────────
    {
      schemaKey: 'root/contracts',
      name: 'API Contracts',
      contextType: 'reference',
      tier: 1,
      order: 13,
      description: 'Contract documents per domain — identity, IO, invariants, failure modes, SLOs',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/api', linkType: 'depends-on' },
      ],
      children: [
        {
          schemaKey: 'root/contracts/auth',
          name: 'Auth Contract',
          contextType: 'reference',
          tier: 2,
          order: 0,
          description: 'Cookie/bearer auth, derivation, RBAC contract',
          storageModel: 'content',
          writePolicy: 'scanner',
          links: [
            { toSchemaKey: 'root/backend/auth', linkType: 'see-also' },
          ],
        },
        {
          schemaKey: 'root/contracts/brain-endpoint',
          name: 'Brain Endpoint Contract',
          contextType: 'reference',
          tier: 2,
          order: 1,
          description: 'GET /brain contract — ETag, tier assembly, token budget',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/contracts/entries',
          name: 'Entries Contract',
          contextType: 'reference',
          tier: 2,
          order: 2,
          description: 'Context entries CRUD — ULID ordering, idempotency, cursor pagination',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/contracts/populate',
          name: 'Populate Contract',
          contextType: 'reference',
          tier: 2,
          order: 3,
          description: 'Batch upsert contract — diffStats, dryRun, contentHash dedup',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/contracts/search',
          name: 'Search Contract',
          contextType: 'reference',
          tier: 2,
          order: 4,
          description: 'Unified search contract — proof objects, relevance, link boost',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/contracts/links',
          name: 'Links Contract',
          contextType: 'reference',
          tier: 2,
          order: 5,
          description: 'Context links CRUD — bidirectional queries, confidence scoring',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/contracts/compaction',
          name: 'Compaction Contract',
          contextType: 'reference',
          tier: 2,
          order: 6,
          description: 'Entries compaction contract — rolling summary, no deletion',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
      ],
    },
    {
      schemaKey: 'root/runbooks',
      name: 'Runbooks',
      contextType: 'reference',
      tier: 1,
      order: 14,
      description: 'Operational runbooks for incident response and diagnostics',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/ops', linkType: 'see-also' },
      ],
      children: [
        {
          schemaKey: 'root/runbooks/brain-5xx',
          name: 'Runbook: Brain 5xx',
          contextType: 'reference',
          tier: 2,
          order: 0,
          description: 'Brain endpoint returns 500 — diagnosis and resolution',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/runbooks/populate-stuck',
          name: 'Runbook: Populate Stuck',
          contextType: 'reference',
          tier: 2,
          order: 1,
          description: 'Populate run stuck or failing — diagnosis and resolution',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/runbooks/search-low-recall',
          name: 'Runbook: Search Low Recall',
          contextType: 'reference',
          tier: 2,
          order: 2,
          description: 'Search returns poor results — diagnosis and resolution',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/runbooks/drafts-never-approved',
          name: 'Runbook: Drafts Never Approved',
          contextType: 'reference',
          tier: 2,
          order: 3,
          description: 'Draft contexts accumulate without approval — diagnosis',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/runbooks/audit-mismatch',
          name: 'Runbook: Audit Mismatch',
          contextType: 'reference',
          tier: 2,
          order: 4,
          description: 'Mutation audit log inconsistent — diagnosis and resolution',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
        {
          schemaKey: 'root/runbooks/appwrite-throttling',
          name: 'Runbook: Appwrite Throttling',
          contextType: 'reference',
          tier: 2,
          order: 5,
          description: 'Appwrite rate limits hit — diagnosis and mitigation',
          storageModel: 'content',
          writePolicy: 'scanner',
        },
      ],
    },
    {
      schemaKey: 'root/ops',
      name: 'Operations & SLOs',
      contextType: 'reference',
      tier: 1,
      order: 15,
      description: 'SLOs per CUJ, error budget policy, golden signals, observability',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/contracts', linkType: 'depends-on' },
      ],
    },
    {
      schemaKey: 'root/security',
      name: 'Security & Threat Model',
      contextType: 'reference',
      tier: 1,
      order: 16,
      description: 'STRIDE threat model, ASVS checklist, auth surface, mitigations',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/backend/auth', linkType: 'see-also' },
      ],
    },
    {
      schemaKey: 'root/governance',
      name: 'Data Governance',
      contextType: 'reference',
      tier: 1,
      order: 17,
      description: 'Lifecycle rules, immutable fields, integrity jobs, state machine',
      storageModel: 'content',
      writePolicy: 'scanner',
    },
    {
      schemaKey: 'root/quality',
      name: 'Quality Gates',
      contextType: 'reference',
      tier: 1,
      order: 18,
      description: 'Test suites, contract tests, retrieval eval, populate gates',
      storageModel: 'content',
      writePolicy: 'scanner',
    },
    {
      schemaKey: 'root/performance',
      name: 'Performance & Cost',
      contextType: 'reference',
      tier: 1,
      order: 19,
      description: 'Token budgets, degradation strategy, cheap retrieval, cost tracking',
      storageModel: 'content',
      writePolicy: 'scanner',
    },
    {
      schemaKey: 'root/patterns',
      name: 'Patterns Cookbook',
      contextType: 'reference',
      tier: 1,
      order: 20,
      description: 'Canonical code patterns with snippets — OCC, idempotency, ETag, pagination',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/conventions', linkType: 'see-also' },
      ],
    },
    {
      schemaKey: 'root/flows',
      name: 'Data Flows',
      contextType: 'reference',
      tier: 1,
      order: 21,
      description: 'Mermaid sequence diagrams for critical paths — auth, save, populate, search',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/api', linkType: 'see-also' },
      ],
    },
    {
      schemaKey: 'root/schema',
      name: 'DB Schema Docs',
      contextType: 'reference',
      tier: 1,
      order: 22,
      description: 'Appwrite collections, attributes, types, indexes with justifications',
      storageModel: 'content',
      writePolicy: 'scanner',
      links: [
        { toSchemaKey: 'root/stack/database', linkType: 'see-also' },
      ],
    },
    {
      schemaKey: 'root/adrs',
      name: 'Architecture Decision Records',
      contextType: 'memory',
      tier: 1,
      order: 23,
      description: 'Formal ADRs — context, options, decision, tradeoffs, consequences',
      storageModel: 'content',
      writePolicy: 'both',
      links: [
        { toSchemaKey: 'root/decisions', linkType: 'see-also' },
      ],
    },
  ],
};

/** Flatten the brain schema tree into a Map */
function buildSchemaKeyMap(node: BrainNode): void {
  SCHEMA_KEY_MAP.set(node.schemaKey, node);
  if (node.children) {
    for (const child of node.children) {
      buildSchemaKeyMap(child);
    }
  }
}
buildSchemaKeyMap(BRAIN_SCHEMA);

/** Get a BrainNode by its schemaKey */
export function getBrainNode(schemaKey: string): BrainNode | undefined {
  return SCHEMA_KEY_MAP.get(schemaKey);
}

/** Get all schemaKeys in the brain */
export function getAllSchemaKeys(): string[] {
  return Array.from(SCHEMA_KEY_MAP.keys());
}

/** Check if a schemaKey uses the entries storage model */
export function isEntriesModel(schemaKey: string): boolean {
  const node = SCHEMA_KEY_MAP.get(schemaKey);
  return node?.storageModel === 'entries';
}

/** Get all static links declared in the brain schema */
export function getAllStaticLinks(): SchemaLink[] {
  const links: SchemaLink[] = [];
  function collect(node: BrainNode): void {
    if (node.links) {
      for (const link of node.links) {
        links.push({ toSchemaKey: link.toSchemaKey, linkType: link.linkType });
      }
    }
    if (node.children) {
      for (const child of node.children) {
        collect(child);
      }
    }
  }
  collect(BRAIN_SCHEMA);
  return links;
}
