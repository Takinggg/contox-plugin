import { Command } from 'commander';
import chalk from 'chalk';
import { createApiClient, handleApiError } from '../lib/api.js';
import type { ContextItem } from '../lib/api.js';
import { findProjectConfig } from '../lib/config.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox oncall — View on-call operational summary
 *
 * Shows recent sessions, stale drafts, recent bugs, and brain health stats.
 *
 * Usage:
 *   contox oncall              → show last 24h summary
 *   contox oncall --since 2025-01-01
 *   contox oncall --json
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const oncallCommand = new Command('oncall')
  .description('View on-call operational summary (recent sessions, stale drafts, bugs, health)')
  .option('--since <date>', 'ISO date — show data since this time (default: last 24h)')
  .option('--json', 'Output as JSON')
  .action(async (opts: { since?: string; json?: boolean }) => {
    const projectConfig = findProjectConfig();
    const api = createApiClient();
    if (!api) { return; }

    if (!projectConfig) {
      console.error(chalk.red('✗'), 'No project configured. Run', chalk.cyan('contox init'), 'first.');
      process.exitCode = 1;
      return;
    }

    const since = opts.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    try {
      // Fetch all contexts for stats
      const res = await api.get(
        `/api/contexts?teamId=${encodeURIComponent(projectConfig.teamId)}&projectId=${encodeURIComponent(projectConfig.projectId)}`,
      );
      if (!res.ok) {
        await handleApiError(res, 'Failed to fetch contexts');
        return;
      }

      const contexts = (await res.json()) as ContextItem[];

      const approved = contexts.filter((c) => c.status === 'approved' || !c.status).length;
      const drafts = contexts.filter((c) => c.status === 'draft').length;
      const deprecated = contexts.filter((c) => c.status === 'deprecated').length;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const staleDrafts = contexts.filter((c) => c.status === 'draft' && (c.lastSynced ?? '') < sevenDaysAgo);

      if (opts.json) {
        process.stdout.write(JSON.stringify({
          since,
          total: contexts.length,
          approved,
          drafts,
          deprecated,
          staleDrafts: staleDrafts.length,
        }, null, 2) + '\n');
        return;
      }

      console.log(chalk.cyan.bold('\n  On-Call Summary'));
      console.log(chalk.gray(`  Since: ${since}\n`));

      console.log(chalk.white.bold('  Brain Health'));
      console.log(`  Total contexts: ${chalk.cyan(String(contexts.length))}`);
      console.log(`  Approved: ${chalk.green(String(approved))}`);
      console.log(`  Draft: ${chalk.yellow(String(drafts))}`);
      console.log(`  Deprecated: ${chalk.gray(String(deprecated))}`);
      console.log('');

      if (staleDrafts.length > 0) {
        console.log(chalk.yellow.bold(`  ⚠ Stale Drafts (${staleDrafts.length}):`));
        for (const d of staleDrafts.slice(0, 5)) {
          console.log(`    - ${d.name}`);
        }
        if (staleDrafts.length > 5) {
          console.log(`    ... and ${staleDrafts.length - 5} more`);
        }
      } else {
        console.log(chalk.green('  ✓ No stale drafts'));
      }
      console.log('');
    } catch (err) {
      console.error(chalk.red('✗'), 'Error:', (err as Error).message);
      process.exitCode = 1;
    }
  });
