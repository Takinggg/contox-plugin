import { Command } from 'commander';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { createApiClient, handleApiError, verifyProjectAccess } from '../lib/api.js';
import type { ContextItem } from '../lib/api.js';
import { findProjectConfig } from '../lib/config.js';
import { scanProject } from '../lib/scanner.js';
import { buildContext, buildSubContexts, countTokens } from '../lib/context-builder.js';
import type { SubContextOutput } from '../lib/context-builder.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox scan — Scan project and create hierarchical sub-contexts
 *
 * Analyzes the codebase and generates structured context organized into:
 * - [Scan] Overview — Stack, stats, structure
 * - [Scan] Routes & API — Pages and API endpoints
 * - [Scan] Components — Component inventory by directory
 * - [Scan] Dependencies — Runtime + dev deps, scripts
 * - [Scan] Configuration — TypeScript config, env vars
 * - [Scan] Documentation — Key files (README, CLAUDE.md, etc.)
 *
 * These are separate from [Memory] sub-contexts (which track session history).
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const scanCommand = new Command('scan')
  .description('Scan project and generate hierarchical AI contexts')
  .option('-d, --dir <directory>', 'Project directory to scan', '.')
  .option('--dry-run', 'Generate context locally without pushing')
  .option('-o, --output <file>', 'Save generated context to a file (single document)')
  .option('--flat', 'Create one flat context instead of sub-contexts')
  .option('-p, --project <projectId>', 'Target project ID (overrides .contox.json)')
  .option('-t, --team <teamId>', 'Team ID (overrides .contox.json)')
  .action(async (opts: {
    dir: string;
    dryRun?: boolean;
    output?: string;
    flat?: boolean;
    project?: string;
    team?: string;
  }) => {
    const rootDir = resolve(opts.dir);
    const projectConfig = findProjectConfig(rootDir);

    console.log(chalk.bold('\n  Contox Scanner\n'));
    console.log(`  ${chalk.dim('Directory:')} ${rootDir}`);

    // ── Scan ─────────────────────────────────────────────────────────────────
    console.log(`  ${chalk.dim('Scanning...')}`);
    const scan = scanProject(rootDir);

    const apiRoutes = scan.routes.filter(r => !r.methods.includes('PAGE'));
    const pageRoutes = scan.routes.filter(r => r.methods.includes('PAGE'));
    const totalExports = scan.libs.reduce((sum, l) => sum + l.exports.length, 0)
      + scan.hooks.reduce((sum, l) => sum + l.exports.length, 0)
      + scan.stores.reduce((sum, l) => sum + l.exports.length, 0);

    console.log(`  ${chalk.green('✓')} Found ${chalk.bold(String(scan.stats.totalFiles))} files, ${chalk.bold(String(scan.stats.totalDirs))} dirs`);
    console.log(`  ${chalk.green('✓')} ${chalk.bold(String(apiRoutes.length))} API endpoints, ${chalk.bold(String(pageRoutes.length))} pages`);
    console.log(`  ${chalk.green('✓')} ${chalk.bold(String(scan.components.length))} components, ${chalk.bold(String(scan.libs.length))} libs, ${chalk.bold(String(scan.hooks.length))} hooks`);
    console.log(`  ${chalk.green('✓')} ${chalk.bold(String(totalExports))} exported functions/types extracted`);
    console.log(`  ${chalk.green('✓')} ${chalk.bold(String(scan.keyFiles.length))} key documentation files`);

    // ── Build context ────────────────────────────────────────────────────────
    if (opts.flat || opts.output) {
      // Flat mode: single document
      console.log(`  ${chalk.dim('Building flat context...')}`);
      const context = buildContext(scan);
      const tokens = countTokens(context);
      console.log(`  ${chalk.green('✓')} Context: ${chalk.bold(String(Math.round(context.length / 1024)))}KB, ~${chalk.bold(String(tokens))} tokens`);

      if (opts.output) {
        const outPath = resolve(opts.output);
        writeFileSync(outPath, context, 'utf-8');
        console.log(`  ${chalk.green('✓')} Saved to ${chalk.cyan(outPath)}`);
      }

      if (opts.dryRun || !opts.flat) {
        if (opts.dryRun) {
          console.log(`\n  ${chalk.yellow('Dry run')} — context not pushed.\n`);
        }
        return;
      }

      // Push flat context
      await pushFlatContext(context, tokens, opts, projectConfig);
      return;
    }

    // ── Hierarchical mode (default): create sub-contexts ──────────────────
    console.log(`  ${chalk.dim('Building sub-contexts...')}`);
    const subContexts = buildSubContexts(scan);

    let totalTokens = 0;
    for (const sc of subContexts) {
      totalTokens += countTokens(sc.content);
    }
    console.log(`  ${chalk.green('✓')} ${chalk.bold(String(subContexts.length))} sub-contexts, ~${chalk.bold(String(totalTokens))} tokens total`);

    if (opts.dryRun) {
      console.log('');
      for (const sc of subContexts) {
        const t = countTokens(sc.content);
        const sk = chalk.dim(`[${sc.schemaKey}]`);
        console.log(`  ${chalk.cyan(sc.name)} ${sk} ${chalk.dim(`(~${String(t)} tokens)`)}`);
      }
      console.log(`\n  ${chalk.yellow('Dry run')} — not pushed.\n`);
      return;
    }

    // Push hierarchical sub-contexts
    await pushSubContexts(subContexts, opts, projectConfig);
  });

interface PushOpts {
  team?: string;
  project?: string;
}

interface ProjectConfigRef {
  teamId: string;
  projectId: string;
}

interface PopulateNode {
  schemaKey: string;
  name: string;
  content?: string;
  description?: string;
  contextType?: string;
  tier?: number;
  parentSchemaKey?: string;
}

interface PopulateResult {
  runId: string;
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  errors?: string[];
}

async function pushSubContexts(
  subContexts: SubContextOutput[],
  opts: PushOpts,
  projectConfig: ProjectConfigRef | null,
): Promise<void> {
  const api = createApiClient();
  if (!api) { return; }

  const teamId = opts.team ?? projectConfig?.teamId;
  const projectId = opts.project ?? projectConfig?.projectId;

  if (!teamId || !projectId) {
    console.log(`\n  ${chalk.red('✗')} No project configured. Run ${chalk.cyan('contox init')} first.\n`);
    return;
  }

  // Pre-flight: verify access to the project
  if (!(await verifyProjectAccess(api, projectId))) { return; }

  // Map sub-contexts to populate nodes, sorted by schemaKey depth so parents
  // are created before children (the populate API resolves parentSchemaKey
  // against already-processed nodes in the same batch).
  const nodes: PopulateNode[] = subContexts
    .sort((a, b) => {
      const depthA = a.schemaKey.split('/').length;
      const depthB = b.schemaKey.split('/').length;
      if (depthA !== depthB) { return depthA - depthB; }
      return a.order - b.order;
    })
    .map(sc => ({
      schemaKey: sc.schemaKey,
      name: sc.name,
      content: sc.content,
      description: sc.description,
      contextType: sc.contextType ?? 'reference',
      tier: sc.tier ?? 2,
      parentSchemaKey: sc.parentSchemaKey,
    }));

  // Populate API accepts max 50 nodes per batch
  const batchSize = 50;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  const allErrors: string[] = [];

  console.log('');

  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(nodes.length / batchSize);

    if (totalBatches > 1) {
      console.log(`  ${chalk.dim(`Batch ${String(batchNum)}/${String(totalBatches)}...`)}`);
    }

    try {
      const res = await api.post('/api/contexts/populate', {
        teamId,
        projectId,
        nodes: batch,
        source: 'cli-scan',
      });

      if (!res.ok) {
        await handleApiError(res, 'Populate API failed');
        return;
      }

      const result = (await res.json()) as PopulateResult;
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalUnchanged += result.unchanged;

      if (result.errors) {
        allErrors.push(...result.errors);
      }

      // Log individual results
      for (const node of batch) {
        console.log(`  ${chalk.green('✓')} ${chalk.bold(node.name)} ${chalk.dim(`[${node.schemaKey}]`)}`);
      }
    } catch (err) {
      console.log(`  ${chalk.red('✗')} Network error:`, (err as Error).message);
      return;
    }
  }

  if (allErrors.length > 0) {
    console.log(`\n  ${chalk.yellow('Warnings:')}`);
    for (const err of allErrors) {
      console.log(`    ${chalk.yellow('⚠')} ${err}`);
    }
  }

  console.log(`\n  ${chalk.green('Done!')} Created ${String(totalCreated)}, updated ${String(totalUpdated)}, unchanged ${String(totalUnchanged)}.\n`);
}

async function pushFlatContext(
  context: string,
  tokens: number,
  opts: PushOpts,
  projectConfig: ProjectConfigRef | null,
): Promise<void> {
  const api = createApiClient();
  if (!api) { return; }

  const teamId = opts.team ?? projectConfig?.teamId;
  const projectId = opts.project ?? projectConfig?.projectId;

  if (!teamId || !projectId) {
    console.log(`\n  ${chalk.red('✗')} No project configured. Run ${chalk.cyan('contox init')} first.\n`);
    return;
  }

  // Pre-flight: verify access to the project
  if (!(await verifyProjectAccess(api, projectId))) { return; }

  const contextName = '.contox-context';

  try {
    const res = await api.get(`/api/contexts?projectId=${encodeURIComponent(projectId)}`);
    if (res.ok) {
      const existing = (await res.json()) as ContextItem[];
      const found = existing.find((c) => c.name === contextName);

      if (found) {
        const patchRes = await api.patch(`/api/contexts/${found.id}`, { content: context });
        if (patchRes.ok) {
          console.log(`\n  ${chalk.green('✓')} Updated context ${chalk.bold(contextName)} (~${String(tokens)} tokens)\n`);
          return;
        }
        await handleApiError(patchRes, 'Failed to update context');
        return;
      }
    }
  } catch {
    // continue to create
  }

  try {
    const createRes = await api.post('/api/contexts', {
      name: contextName,
      description: 'Auto-generated project context by Contox CLI scanner',
      teamId,
      projectId,
    });

    if (!createRes.ok) {
      await handleApiError(createRes, 'Failed to create context');
      return;
    }

    const created = (await createRes.json()) as ContextItem;
    const patchRes = await api.patch(`/api/contexts/${created.id}`, { content: context });
    if (patchRes.ok) {
      console.log(`\n  ${chalk.green('✓')} Created ${chalk.bold(contextName)} (~${String(tokens)} tokens)\n`);
    }
  } catch (err) {
    console.log(`\n  ${chalk.red('✗')} Error:`, (err as Error).message, '\n');
  }
}
