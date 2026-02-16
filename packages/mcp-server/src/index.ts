#!/usr/bin/env node

/* ═══════════════════════════════════════════════════════════════════════════════
 * Contox MCP Server — Persistent AI Project Memory (V2 Pipeline)
 *
 * 23 tools for full brain management:
 * - contox_get_memory      → Load V2 brain document (structured memory items)
 * - contox_save_session    → Save session via V2 ingest pipeline
 * - contox_list/get/create/update/delete → CRUD operations
 * - contox_search          → Semantic search via V2 embeddings
 * - contox_context_pack    → Build focused context pack (token-budgeted)
 * - contox_populate        → Populate brain hierarchy (audit trail, draft default)
 * - contox_add_entry       → Add entry to journal-like context (idempotent)
 * - contox_get_tree        → Get hierarchical brain tree
 * - contox_approve         → Approve or deprecate a context (state machine)
 * - contox_get_links       → Get context links (incoming/outgoing)
 * - contox_add_link        → Create a link between two contexts
 * - contox_compact         → Compact entries into a summary
 * - contox_oncall_view     → On-call operational summary
 * - contox_explain_schemakey → Deep-dive into any schemaKey
 * - contox_scan            → Scan codebase and push hierarchical sub-contexts
 * - contox_git_digest      → Read git commits since last save for Claude enrichment
 * - contox_hygiene         → Memory hygiene agent (analyze + apply)
 * - contox_auto_resolve    → Auto-resolve memory items from committed fixes
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ContoxApiClient } from './api/client.js';
import { V2Client } from './api/v2-client.js';
import { CATEGORIES } from './lib/categories.js';
import { buildOncallView } from './lib/oncall-view.js';
import { explainSchemaKey } from './lib/explain-schema-key.js';
import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { scanProject } from './lib/scanner.js';
import { buildSubContexts, countTokens } from './lib/context-builder.js';
import { getGitDigest, formatDigest } from './lib/git-digest.js';
import { resolveProject } from './lib/project-resolver.js';
import { updateClaudeMd } from './lib/claude-md.js';
import { assembleContextPack } from './lib/context-pack.js';

const server = new McpServer({
  name: 'contox',
  version: '1.1.0',
});

// Clients are initialized in main() via resolveProject() before server.connect()
let client!: ContoxApiClient;
let v2Client!: V2Client;

/* ── Tool 1: Get Project Memory ───────────────────────────────────────────── */
server.tool(
  'contox_get_memory',
  `Load the complete project memory. Call this at the START of every session to remember previous work. Returns a markdown document with: Architecture, Conventions, Implementation Log, Decisions, Bugs & Fixes, Todo, and Session Log.`,
  {},
  async () => {
    try {
      const brain = await v2Client.getBrain();

      // Use compact brain (~3K tokens) instead of full brain (~20K+ tokens)
      // AI should use contox_search for specific topics
      const output = brain.summary || brain.document;
      const tokenEst = Math.ceil(output.length / 4);

      const footer = [
        '---',
        `_${String(brain.itemsLoaded)} total items in memory | showing compact overview (~${String(tokenEst)} tokens) | hash: ${brain.brainHash}_`,
        '',
        '> **Tip:** Use `contox_search "your query"` to find specific memory items about what you\'re working on.',
        '> Use `contox_context_pack` with a task description for focused, task-relevant context.',
      ].join('\n');

      return {
        content: [{
          type: 'text',
          text: `${output}\n${footer}\n`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error loading memory: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 2: Save Session ─────────────────────────────────────────────────── */
const categoryEnum = CATEGORIES
  .filter((c) => c.id !== 'sessions')
  .map((c) => `"${c.id}": ${c.description}`)
  .join('\n');

server.tool(
  'contox_save_session',
  `Save this session's work into persistent project memory.

IMPORTANT: Only call this tool when the user EXPLICITLY asks to save (e.g. "save", "save session", "contox save"). NEVER call it automatically or proactively — the user may be working on multiple tasks in parallel and needs to control when sessions are saved.

Provide a summary and structured changes. Each change has a category, title, and content.

Available categories:
${categoryEnum}

The session log is updated automatically. Content is APPENDED to existing sub-contexts (never overwritten).`,
  {
    summary: z.string().describe('Brief session summary (1-3 sentences): what was accomplished'),
    changes: z.array(
      z.object({
        category: z.enum(['architecture', 'conventions', 'implementation', 'decisions', 'bugs', 'todo'])
          .describe('Category for this change'),
        title: z.string().describe('Brief title (e.g. "Added auth middleware", "Fixed CSS z-index bug")'),
        content: z.string().describe('Detailed content to save. Use markdown. Be specific and include file paths, patterns, key decisions.'),
      }),
    ).describe('List of changes to save, organized by category'),
    headCommitSha: z.string().optional().describe('HEAD commit SHA at save time (from contox_git_digest). Tracks save position for incremental digests.'),
  },
  async (params) => {
    try {
      const v2Result = await v2Client.ingest({
        type: 'mcp_save',
        summary: params.summary,
        changes: params.changes,
        headCommitSha: params.headCommitSha,
      });

      // Post-save: update CLAUDE.md with V2 brain summary (fire-and-forget)
      v2Client.getBrain()
        .then((brain) => { updateClaudeMd(process.cwd(), client, brain.document, brain.summary).catch(() => { /* non-critical */ }); })
        .catch(() => {
          // V2 brain failed — fall back to V1
          updateClaudeMd(process.cwd(), client).catch(() => { /* non-critical */ });
        });

      // Post-save: auto-resolve memory items that match committed files (fire-and-forget)
      let autoResolveNote = '';
      if (params.headCommitSha) {
        getGitDigest(client, { limit: 10 })
          .then((digest) => {
            if (digest.commits.length > 0) {
              const commits = digest.commits.map((c) => ({
                sha: c.sha,
                message: c.message,
                files: c.files,
              }));
              return v2Client.autoResolve(commits);
            }
            return null;
          })
          .then((result) => {
            if (result && result.resolved.length > 0) {
              console.error(`[auto-resolve] Post-save: resolved ${String(result.resolved.length)} memory items`);
            }
          })
          .catch(() => { /* non-critical */ });
        autoResolveNote = '\nAuto-resolve running in background — matching commits against existing memory items.';
      }

      return {
        content: [{
          type: 'text',
          text: [
            `Session saved via V2 pipeline.`,
            `- Event ID: ${v2Result.eventId}`,
            `- Session: ${v2Result.sessionId}`,
            `Raw event stored. Enrichment deferred — user must click "Generate Memory" in the dashboard to trigger the pipeline.`,
            autoResolveNote,
          ].join('\n'),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error saving session: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 3: List Contexts ────────────────────────────────────────────────── */
server.tool(
  'contox_list_contexts',
  'List all contexts for the current project (including sub-contexts)',
  {},
  async () => {
    try {
      const contexts = await client.listContexts();
      const summary = contexts.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        parentContextId: c.parentContextId,
        schemaKey: c.schemaKey,
        tier: c.tier,
        state: c.state,
        tokens: c.tokens,
        updatedAt: c.updatedAt,
      }));
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 4: Get Context ──────────────────────────────────────────────────── */
server.tool(
  'contox_get_context',
  'Get a specific context by ID, including its full content',
  { id: z.string().describe('The context ID') },
  async (params) => {
    try {
      const context = await client.getContext(params.id);
      return {
        content: [{ type: 'text', text: JSON.stringify(context, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 5: Create Context ───────────────────────────────────────────────── */
server.tool(
  'contox_create_context',
  'Create a new context manually.',
  {
    name: z.string().describe('Context name'),
    description: z.string().optional().describe('Optional description'),
    content: z.string().optional().describe('Optional initial content'),
    parentContextId: z.string().optional().describe('Optional parent context ID for hierarchy'),
  },
  async (params) => {
    try {
      const context = await client.createContext({
        name: params.name,
        teamId: client.teamId,
        projectId: client.projectId,
        description: params.description,
        parentContextId: params.parentContextId,
      });

      if (params.content) {
        await client.updateContext(context.id, { content: params.content });
      }

      return {
        content: [{
          type: 'text',
          text: `Context created: ${context.name} (${context.id})`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 6: Update Context ───────────────────────────────────────────────── */
server.tool(
  'contox_update_context',
  'Update an existing context (name, description, or content). Content is replaced, not appended.',
  {
    id: z.string().describe('The context ID to update'),
    name: z.string().optional().describe('New name'),
    description: z.string().optional().describe('New description'),
    content: z.string().optional().describe('New content (replaces existing)'),
  },
  async (params) => {
    try {
      const updateData: Record<string, string> = {};
      if (params.name !== undefined) { updateData['name'] = params.name; }
      if (params.description !== undefined) { updateData['description'] = params.description; }
      if (params.content !== undefined) { updateData['content'] = params.content; }

      const context = await client.updateContext(params.id, updateData);
      return {
        content: [{
          type: 'text',
          text: `Context updated: ${context.name} (${context.id})`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 7: Delete Context ───────────────────────────────────────────────── */
server.tool(
  'contox_delete_context',
  'Delete a context by ID. This is irreversible.',
  { id: z.string().describe('The context ID to delete') },
  async (params) => {
    try {
      await client.deleteContext(params.id);
      return {
        content: [{ type: 'text', text: `Context deleted: ${params.id}` }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 8: Search Contexts ──────────────────────────────────────────────── */
server.tool(
  'contox_search',
  `Search contexts by name, description, AND content. Use this to find specific code patterns, function signatures, API endpoints, component props, or any information stored in the project memory. Returns matching snippets with surrounding context.

Examples: "useAuth", "stripe", "password reset", "Button props", "GET /api/contexts"`,
  { query: z.string().describe('Search query — searches across all context content, names, and descriptions') },
  async (params) => {
    try {
      const v2Results = await v2Client.search(params.query, { limit: 10, minSimilarity: 0.65 });

      if (v2Results.results.length === 0) {
        return {
          content: [{ type: 'text', text: `No results found for "${params.query}" (semantic search, ${String(v2Results.totalCandidates)} candidates)` }],
        };
      }

      const output: string[] = [];
      output.push(`Found ${String(v2Results.results.length)} result(s) for "${params.query}" (semantic, ${String(v2Results.totalCandidates)} candidates):\n`);

      for (const r of v2Results.results) {
        output.push(`## ${r.title}`);
        output.push(`> ${r.type} | similarity: ${r.similarity.toFixed(3)} | confidence: ${r.confidence.toFixed(2)} | ${r.schemaKey}`);
        if (r.files.length > 0) {
          output.push(`> files: ${r.files.slice(0, 5).join(', ')}`);
        }
        output.push('');
        output.push(r.facts);
        output.push('');
      }

      return {
        content: [{ type: 'text', text: output.join('\n') }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 9: Populate Brain ───────────────────────────────────────────────── */
server.tool(
  'contox_populate',
  `Populate the brain hierarchy with structured contexts. Used by scanners and CLI to batch-create/update contexts by schemaKey. Created contexts default to state 'draft'. Returns audit trail with runId and diff stats.`,
  {
    nodes: z.array(
      z.object({
        schemaKey: z.string().describe('Unique schema key (e.g. "root/api/auth")'),
        name: z.string().describe('Display name for the context'),
        content: z.string().optional().describe('Markdown content'),
        description: z.string().optional().describe('Brief description'),
        contextType: z.enum(['system', 'reference', 'memory']).optional().describe('Context type'),
        tier: z.number().optional().describe('Tier (1=always loaded, 2=on-demand, 3=archive)'),
        parentSchemaKey: z.string().optional().describe('Parent schema key for hierarchy'),
      }),
    ).describe('List of nodes to populate'),
    dryRun: z.boolean().optional().describe('If true, only return diff stats without writing'),
    source: z.string().optional().describe('Source identifier (e.g. "cli-scan", "mcp-populate")'),
  },
  async (params) => {
    try {
      const result = await client.populate(params.nodes, params.dryRun, params.source);
      return {
        content: [{
          type: 'text',
          text: [
            `Populate ${params.dryRun ? '(dry run) ' : ''}completed.`,
            `- Run ID: ${result.runId}`,
            `- Created: ${String(result.created)}`,
            `- Updated: ${String(result.updated)}`,
            `- Unchanged: ${String(result.unchanged)}`,
            `- Errors: ${String(result.errors)}`,
          ].join('\n'),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 10: Add Entry ───────────────────────────────────────────────────── */
server.tool(
  'contox_add_entry',
  `Add an entry to a journal-like context (bugs, implementation journal, sessions). Entries are INSERT-only (event-sourced) and idempotent via idempotencyKey. Uses client-generated ULID for monotone ordering.`,
  {
    contextId: z.string().describe('Target context ID'),
    title: z.string().describe('Entry title (max 200 chars)'),
    content: z.string().describe('Entry content in markdown'),
    entryType: z.string().optional().describe('Entry type (e.g. "bug-fix", "feature", "session")'),
    tags: z.array(z.string()).optional().describe('Tags for categorization'),
    idempotencyKey: z.string().optional().describe('Idempotency key for retry safety'),
    source: z.string().optional().describe('Source identifier'),
    sourceRef: z.string().optional().describe('Source reference (commit SHA, session ID, etc.)'),
  },
  async (params) => {
    try {
      const entry = await client.createEntry({
        contextId: params.contextId,
        title: params.title,
        content: params.content,
        entryType: params.entryType,
        tags: params.tags,
        idempotencyKey: params.idempotencyKey,
        source: params.source,
        sourceRef: params.sourceRef,
      });

      return {
        content: [{
          type: 'text',
          text: `Entry added: ${entry.title} (${entry.id})`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 11: Get Brain Tree ─────────────────────────────────────────── */
server.tool(
  'contox_get_tree',
  `Get the hierarchical brain tree for the current project. Returns a nested tree of contexts with schemaKey, tier, state, contextType, and children. Useful for understanding the project knowledge structure at a glance.`,
  {},
  async () => {
    try {
      const result = await client.getTree();
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result.tree, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 12: Approve / Deprecate Context ───────────────────────────── */
server.tool(
  'contox_approve',
  `Approve or deprecate a context (state machine). Approved contexts are included in the brain document. Deprecated contexts are hidden. Only works on contexts with a state (draft → approved → deprecated).`,
  {
    id: z.string().describe('The context ID'),
    action: z.enum(['approve', 'deprecate']).describe('"approve" to make visible in brain, "deprecate" to hide'),
  },
  async (params) => {
    try {
      if (params.action === 'approve') {
        await client.approveContext(params.id);
      } else {
        await client.deprecateContext(params.id);
      }
      return {
        content: [{
          type: 'text',
          text: `Context ${params.action === 'approve' ? 'approved' : 'deprecated'}: ${params.id}`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 13: Get Context Links ─────────────────────────────────────── */
server.tool(
  'contox_get_links',
  `Get links for a context by its schemaKey. Returns incoming and outgoing links with linkType, reason, and confidence. Links represent relationships between contexts (see-also, depends-on, child-of, related).`,
  {
    schemaKey: z.string().describe('The schemaKey of the context (e.g. "root/api/auth")'),
    direction: z.enum(['both', 'outgoing', 'incoming']).optional().describe('Filter direction (default: both)'),
  },
  async (params) => {
    try {
      const links = await client.getLinks(params.schemaKey, params.direction);

      const output: string[] = [];
      if (links.outgoing.length > 0) {
        output.push(`## Outgoing (${String(links.outgoing.length)})`);
        for (const link of links.outgoing) {
          output.push(`- → ${link.toSchemaKey} [${link.linkType}]${link.reason ? ` — ${link.reason}` : ''}${link.confidence !== null ? ` (conf: ${String(link.confidence)})` : ''}`);
        }
      }
      if (links.incoming.length > 0) {
        output.push(`## Incoming (${String(links.incoming.length)})`);
        for (const link of links.incoming) {
          output.push(`- ← ${link.fromSchemaKey} [${link.linkType}]${link.reason ? ` — ${link.reason}` : ''}${link.confidence !== null ? ` (conf: ${String(link.confidence)})` : ''}`);
        }
      }
      if (output.length === 0) {
        output.push(`No links found for "${params.schemaKey}"`);
      }

      return {
        content: [{ type: 'text', text: output.join('\n') }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 14: Add Context Link ──────────────────────────────────────── */
server.tool(
  'contox_add_link',
  `Create a directed link between two contexts by their schemaKeys. Links form a knowledge graph — use them to express relationships like "depends-on", "see-also", "child-of", or "related".`,
  {
    from: z.string().describe('Source schemaKey (e.g. "root/frontend/hooks")'),
    to: z.string().describe('Target schemaKey (e.g. "root/api/auth")'),
    linkType: z.enum(['see-also', 'depends-on', 'child-of', 'related']).describe('Type of relationship'),
    reason: z.string().optional().describe('Why this link exists'),
    confidence: z.number().optional().describe('Confidence score 0-1 (e.g. 0.9 = very confident)'),
  },
  async (params) => {
    try {
      await client.createLink(params.from, params.to, params.linkType, params.reason, params.confidence);
      return {
        content: [{
          type: 'text',
          text: `Link created: ${params.from} → ${params.to} [${params.linkType}]`,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 15: Compact Entries ───────────────────────────────────────── */
server.tool(
  'contox_compact',
  `Compact entries for a journal-like context (bugs, journal, sessions). Summarizes all entries into a single content block, reducing token count while preserving key information. Use when a context has too many entries.`,
  {
    id: z.string().describe('The context ID to compact'),
  },
  async (params) => {
    try {
      const result = await client.compactContext(params.id);
      return {
        content: [{
          type: 'text',
          text: [
            `Compaction completed for context ${params.id}:`,
            `- Entries processed: ${String(result.entriesCount)}`,
            `- Summary length: ${String(result.summaryLength)} chars`,
            `- ${result.message}`,
          ].join('\n'),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 16: On-Call View ─────────────────────────────────────────────── */
server.tool(
  'contox_oncall_view',
  `View on-call operational summary for the current project. Shows recent sessions, stale drafts (>7 days), recent bugs, and brain health stats. Use this for a quick project health check.`,
  {
    since: z.string().optional().describe('ISO date string — show data since this time (default: last 24h)'),
  },
  async (params) => {
    try {
      const view = await buildOncallView(client, { since: params.since });
      return {
        content: [{ type: 'text', text: view }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 17: Explain SchemaKey ───────────────────────────────────────── */
server.tool(
  'contox_explain_schemakey',
  `Deep-dive into any brain schemaKey. Returns: schema metadata (tier, contextType, writePolicy), context content preview, runtime links (incoming/outgoing), recent entries, and related contracts. Use this to understand any part of the brain.`,
  {
    schemaKey: z.string().describe('The schemaKey to explain (e.g. "root/contracts/auth", "root/bugs")'),
  },
  async (params) => {
    try {
      const explanation = await explainSchemaKey(client, params.schemaKey);
      return {
        content: [{ type: 'text', text: explanation }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 18: Scan Codebase ──────────────────────────────────────────── */
server.tool(
  'contox_scan',
  `Scan a local codebase directory and push ~15-20 hierarchical sub-contexts to the project brain. Walks the filesystem to extract routes, components, libraries, hooks, stores, dependencies, and key documentation files. Results are organized into granular sub-contexts mapped to brain schemaKeys and pushed via the populate API with content-hash dedup.

Use this to index a codebase so the AI can understand the project structure without reading source files. The scan respects .gitignore-like exclusions (node_modules, .next, dist, etc.) and reads files up to 32KB.`,
  {
    directory: z.string().optional().describe(
      'Absolute path to the project root directory to scan. Defaults to the current working directory.',
    ),
    dryRun: z.boolean().optional().describe(
      'If true, scan and build sub-contexts but do not push to the API. Returns what would be created/updated.',
    ),
  },
  async (params) => {
    try {
      const rootDir = resolve(params.directory ?? process.cwd());

      // Security: validate the directory exists and is a directory
      if (!existsSync(rootDir) || !statSync(rootDir).isDirectory()) {
        return {
          content: [{ type: 'text' as const, text: `Error: "${rootDir}" is not a valid directory.` }],
          isError: true,
        };
      }

      // Security: prevent scanning outside the workspace (must contain a git repo or package.json)
      const hasGit = existsSync(resolve(rootDir, '.git'));
      const hasPackageJson = existsSync(resolve(rootDir, 'package.json'));
      if (!hasGit && !hasPackageJson) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Directory must be a project root (must contain .git or package.json).' }],
          isError: true,
        };
      }

      // 1. Scan the filesystem
      const scan = scanProject(rootDir);

      const apiRoutes = scan.routes.filter((r) => !r.methods.includes('PAGE'));
      const pageRoutes = scan.routes.filter((r) => r.methods.includes('PAGE'));
      const totalExports = [...scan.libs, ...scan.hooks, ...scan.stores]
        .reduce((sum, l) => sum + l.exports.length, 0);

      // 2. Build sub-contexts
      const subContexts = buildSubContexts(scan);

      let totalTokens = 0;
      for (const sc of subContexts) {
        totalTokens += countTokens(sc.content);
      }

      // 3. Build scan stats summary
      const statsLines: string[] = [
        `Scan completed for: ${rootDir}`,
        `- Files: ${String(scan.stats.totalFiles)}, Directories: ${String(scan.stats.totalDirs)}`,
        `- API endpoints: ${String(apiRoutes.length)}, Pages: ${String(pageRoutes.length)}`,
        `- Components: ${String(scan.components.length)}, Libraries: ${String(scan.libs.length)}, Hooks: ${String(scan.hooks.length)}, Stores: ${String(scan.stores.length)}`,
        `- Exported functions/types: ${String(totalExports)}`,
        `- Key documentation files: ${String(scan.keyFiles.length)}`,
        `- Sub-contexts generated: ${String(subContexts.length)} (~${String(totalTokens)} tokens)`,
      ];

      if (params.dryRun) {
        statsLines.push('');
        statsLines.push('Sub-contexts (dry run — not pushed):');
        for (const sc of subContexts) {
          const t = countTokens(sc.content);
          statsLines.push(`  - ${sc.name} [${sc.schemaKey}] (~${String(t)} tokens)`);
        }
        return {
          content: [{ type: 'text', text: statsLines.join('\n') }],
        };
      }

      // 4. Map sub-contexts to populate nodes (sorted depth-first for parent creation)
      const nodes = subContexts
        .sort((a, b) => {
          const depthA = a.schemaKey.split('/').length;
          const depthB = b.schemaKey.split('/').length;
          if (depthA !== depthB) { return depthA - depthB; }
          return a.order - b.order;
        })
        .map((sc) => ({
          schemaKey: sc.schemaKey,
          name: sc.name,
          content: sc.content,
          description: sc.description,
          contextType: sc.contextType ?? 'reference',
          tier: sc.tier ?? 2,
          parentSchemaKey: sc.parentSchemaKey,
        }));

      // 5. Push via populate API (batch 50)
      const batchSize = 50;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalUnchanged = 0;
      let totalErrors = 0;

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const result = await client.populate(batch, false, 'mcp-scan');
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalUnchanged += result.unchanged;
        totalErrors += result.errors;
      }

      statsLines.push('');
      statsLines.push('Populate results:');
      statsLines.push(`- Created: ${String(totalCreated)}`);
      statsLines.push(`- Updated: ${String(totalUpdated)}`);
      statsLines.push(`- Unchanged: ${String(totalUnchanged)}`);
      if (totalErrors > 0) {
        statsLines.push(`- Errors: ${String(totalErrors)}`);
      }

      return {
        content: [{ type: 'text', text: statsLines.join('\n') }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error scanning codebase: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 19: Git Digest ─────────────────────────────────────────────── */
server.tool(
  'contox_git_digest',
  `Read git commits since last save. Returns structured commit data (SHA, message, files, diff stats, smart patches) + WIP evidence for Claude to analyze and enrich before saving.

Uses SHA-based range tracking (not dates) for reliable incremental digests. The base SHA is read from the last session entry's sourceRef field.`,
  {
    directory: z.string().optional().describe(
      'Absolute path to the git repo root. Defaults to the current working directory.',
    ),
    limit: z.number().optional().describe(
      'Max commits to return. Default 20.',
    ),
    mode: z.enum(['first-parent', 'all']).optional().describe(
      'first-parent (default): clean shipping journal. all: exhaustive including merge commits.',
    ),
  },
  async (params) => {
    try {
      const result = await getGitDigest(client, {
        directory: params.directory,
        limit: params.limit,
        mode: params.mode,
      });

      const formatted = formatDigest(result);

      return {
        content: [{
          type: 'text',
          text: formatted,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error reading git digest: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 20: Context Pack (V2 only) ─────────────────────────────────── */
server.tool(
  'contox_context_pack',
  `Build a focused context pack for the current task. Uses V2 semantic search to find the most relevant memory items and assembles a token-budgeted markdown document.

Scopes:
- "relevant" (default): Semantic search for task-related items only
- "full": Complete brain document, truncated to budget
- "minimal": Top 5 highest-confidence items

Falls back to full brain if semantic search is unavailable.`,
  {
    task: z.string().describe('Current task description — used for semantic search'),
    scope: z.enum(['full', 'relevant', 'minimal']).default('relevant').describe('How much context to include'),
    tokenBudget: z.number().default(4000).describe('Approximate token budget for the pack'),
  },
  async (params) => {
    try {
      const pack = await assembleContextPack(v2Client, {
        task: params.task,
        scope: params.scope,
        tokenBudget: params.tokenBudget,
      });

      return {
        content: [{
          type: 'text',
          text: pack,
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error building context pack: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 21: Ask (V2 only) ───────────────────────────────────────────── */
server.tool(
  'contox_ask',
  `Ask a natural-language question about your project memory. Uses semantic search to find relevant memory items, then synthesizes a cited answer using an LLM.

Returns a markdown answer with [Source N] citations, the matched sources, similarity scores, and token usage.

Requires embeddings to exist (run a Genesis scan first).`,
  {
    question: z.string().min(3).describe('The question to ask about the project memory'),
  },
  async (params) => {
    try {
      if (!v2Client) {
        return {
          content: [{ type: 'text', text: 'Error: V2 API not configured. Set CONTOX_API_KEY and CONTOX_PROJECT_ID.' }],
          isError: true,
        };
      }

      const result = await v2Client.ask(params.question);

      const lines = [
        result.answer,
        '',
        '---',
        `_${String(result.sources.length)} sources | avg similarity: ${(result.avgSimilarity * 100).toFixed(0)}% | ${String(result.usage.totalTokens)} tokens | model: ${result.model}_`,
      ];

      return {
        content: [{
          type: 'text',
          text: lines.join('\n'),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error asking question: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 22: Memory Hygiene ──────────────────────────────────────────── */
server.tool(
  'contox_hygiene',
  `Run the Memory Hygiene Agent to analyze and clean up memory items.

Modes:
- "quick": Analyze the 20 most recent items (fast, low cost)
- "weekly": Analyze all items updated in the last 7 days

The agent proposes safe, minimal edits: rename titles, retag, merge duplicates, deprecate superseded items, flag quality issues, redact secrets. It NEVER auto-applies changes.

Two-phase workflow:
1. Call without "apply" to get a HygienePlan (proposed actions)
2. Call with "apply" + selectedActionIds to execute chosen actions

Each action has a confidence score and requiresHumanApproval flag.`,
  {
    mode: z.enum(['quick', 'weekly']).default('quick').describe(
      'Analysis mode: "quick" (20 recent items) or "weekly" (last 7 days)',
    ),
    schemaKeyPrefix: z.string().optional().describe(
      'Filter items by schemaKey prefix (e.g. "root/bugs")',
    ),
    apply: z.array(z.string()).optional().describe(
      'Action IDs to apply from a previous plan. Omit to analyze only.',
    ),
    plan: z.string().optional().describe(
      'JSON-stringified HygienePlan from a previous analyze call. Required when applying.',
    ),
    dryRun: z.boolean().optional().describe(
      'If true, show what would be applied without executing.',
    ),
  },
  async (params) => {
    try {
      const teamId = process.env['CONTOX_TEAM_ID'] ?? '';

      // Apply mode
      if (params.apply && params.apply.length > 0) {
        if (!params.plan) {
          return {
            content: [{ type: 'text', text: 'Error: "plan" is required when applying actions.' }],
            isError: true,
          };
        }

        let parsedPlan;
        try {
          parsedPlan = JSON.parse(params.plan) as Record<string, unknown>;
        } catch {
          return {
            content: [{ type: 'text', text: 'Error: "plan" must be valid JSON.' }],
            isError: true,
          };
        }

        const result = await v2Client.applyHygiene({
          teamId,
          plan: parsedPlan as unknown as Parameters<typeof v2Client.applyHygiene>[0]['plan'],
          selectedActionIds: params.apply,
          dryRun: params.dryRun,
        });

        const lines = [
          `Hygiene Apply ${params.dryRun ? '(DRY RUN) ' : ''}Result:`,
          `- Applied: ${String(result.appliedActionIds.length)}`,
          `- Skipped: ${String(result.skippedActionIds.length)}`,
          `- Errors: ${String(result.errors.length)}`,
        ];

        if (result.errors.length > 0) {
          lines.push('', 'Errors:');
          for (const err of result.errors) {
            lines.push(`  - ${err.actionId}: ${err.message}`);
          }
        }

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      // Analyze mode
      const report = await v2Client.analyzeHygiene({
        mode: params.mode,
        teamId,
        schemaKeyPrefix: params.schemaKeyPrefix,
      });

      // Format readable output
      const lines = [
        `Memory Hygiene Report (${params.mode} mode)`,
        `${'─'.repeat(40)}`,
        `Items analyzed: ${String(report.metrics.totalMemories)}`,
        `Actions proposed: ${String(report.metrics.actionsCount)}`,
        `Tokens: ${String(report.usage.promptTokens)}+${String(report.usage.completionTokens)}`,
        '',
        report.summary,
      ];

      if (report.warnings.length > 0) {
        lines.push('', 'Warnings:');
        for (const w of report.warnings) {
          lines.push(`  ⚠ ${w}`);
        }
      }

      if (report.actions.length > 0) {
        lines.push('');

        // Group by type
        const byType = new Map<string, typeof report.actions>();
        for (const action of report.actions) {
          const list = byType.get(action.type) ?? [];
          list.push(action);
          byType.set(action.type, list);
        }

        for (const [type, actions] of byType) {
          lines.push(`${type} (${String(actions.length)})`);
          for (const a of actions) {
            const approval = a.requiresHumanApproval ? ' [NEEDS APPROVAL]' : '';
            lines.push(`  • ${a.reason} (confidence: ${String(a.confidence)})${approval}`);
            lines.push(`    id: ${a.actionId} | targets: ${a.targetMemoryIds.join(', ')}`);
          }
          lines.push('');
        }

        lines.push(
          'To apply actions, call contox_hygiene with:',
          '  apply: [actionId1, actionId2, ...]',
          `  plan: '${JSON.stringify(report)}'`,
        );
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Tool 23: Auto-Resolve ───────────────────────────────────────────── */
server.tool(
  'contox_auto_resolve',
  `Automatically resolve memory items when code fixes are committed. Analyzes recent git commits, matches modified files against existing BugFix/Todo/security memory items, and marks resolved items as archived.

Use this AFTER committing fixes to automatically update the project memory. The tool:
1. Reads recent git commits (since last save)
2. Matches commit files against memory items' file references
3. Uses keyword matching (fix, resolve, patch, secure, etc.) as a secondary signal
4. Archives high-confidence matches, flags medium-confidence ones for review

Supports dry-run mode to preview what would be resolved without making changes.`,
  {
    directory: z.string().optional().describe(
      'Absolute path to the git repo root. Defaults to the current working directory.',
    ),
    limit: z.number().optional().describe(
      'Max commits to analyze. Default 20.',
    ),
    dryRun: z.boolean().optional().describe(
      'If true, show what would be resolved without making changes.',
    ),
  },
  async (params) => {
    try {
      // 1. Get git digest (recent commits)
      const digest = await getGitDigest(client, {
        directory: params.directory,
        limit: params.limit,
      });

      if (digest.commits.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No commits found to analyze. Nothing to resolve.',
          }],
        };
      }

      // 2. Map commits to the format expected by auto-resolve API
      const commits = digest.commits.map((c) => ({
        sha: c.sha,
        message: c.message,
        files: c.files,
      }));

      // 3. Call auto-resolve API
      const result = await v2Client.autoResolve(commits, params.dryRun);

      // 4. Format output
      const lines: string[] = [];

      if (result.dryRun) {
        lines.push('# Auto-Resolve (DRY RUN)');
      } else {
        lines.push('# Auto-Resolve Results');
      }
      lines.push('');
      lines.push(`Analyzed **${String(digest.commits.length)}** commits against **${String(result.totalItemsScanned)}** active memory items.`);
      lines.push('');

      if (result.resolved.length === 0) {
        lines.push('No memory items matched the committed changes.');
      } else {
        lines.push(`## Resolved (${String(result.resolved.length)})`);
        lines.push('');

        for (const item of result.resolved) {
          const statusIcon = item.newStatus === 'archived' ? '\u2705' : '\uD83D\uDD0D';
          lines.push(`${statusIcon} **${item.title}** (${item.type})`);
          lines.push(`  - Match: ${item.matchType} | Confidence: ${String(item.confidence)}`);
          lines.push(`  - Commit: ${item.commitSha.slice(0, 7)}`);
          if (item.matchedFiles.length > 0) {
            lines.push(`  - Files: ${item.matchedFiles.join(', ')}`);
          }
          lines.push(`  - Status: ${item.previousStatus} → ${item.newStatus}`);
          lines.push('');
        }
      }

      if (result.skipped.length > 0) {
        lines.push(`## Skipped (${String(result.skipped.length)})`);
        for (const item of result.skipped) {
          lines.push(`- ${item.title}: ${item.reason}`);
        }
        lines.push('');
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error auto-resolving: ${String(err)}` }],
        isError: true,
      };
    }
  },
);

/* ── Start Server ──────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // Resolve project from .contox.json / git repo name / env vars
  const resolved = await resolveProject({
    apiKey: process.env['CONTOX_API_KEY'],
    apiUrl: process.env['CONTOX_API_URL'],
    teamId: process.env['CONTOX_TEAM_ID'],
    projectId: process.env['CONTOX_PROJECT_ID'],
  });
  client = new ContoxApiClient(resolved);

  // Initialize V2 client (per-project secret from setup, then legacy env vars)
  v2Client = new V2Client({
    apiKey: resolved.apiKey ?? '',
    apiUrl: resolved.apiUrl,
    projectId: resolved.projectId ?? '',
    hmacSecret: process.env['CONTOX_HMAC_SECRET'] ?? process.env['V2_HMAC_SECRET_MCP'] ?? process.env['V2_HMAC_SECRET'],
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
