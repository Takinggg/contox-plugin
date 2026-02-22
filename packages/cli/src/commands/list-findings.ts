import { Command } from 'commander';
import chalk from 'chalk';
import { createApiClient, handleApiError, verifyProjectAccess } from '../lib/api.js';
import { findProjectConfig } from '../lib/config.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox list-findings — Browse memory items by category
 *
 * Lists findings (memory items) filtered by category, status, with severity
 * labels derived from importance scores.
 *
 * Usage:
 *   contox list-findings                          → list all active findings
 *   contox list-findings --category security      → security findings only
 *   contox list-findings --category bugs --status review
 *   contox list-findings --json                   → raw JSON output
 * ═══════════════════════════════════════════════════════════════════════════════ */

interface ItemSummary {
  itemId: string;
  title: string;
  type: string;
  facts: string;
  schemaKey: string;
  confidence: number;
  importance: number | null;
  files: string[];
  tags: string[];
  status: string;
}

interface ItemsResponse {
  items: ItemSummary[];
  total: number;
  hasMore: boolean;
}

function getSeverity(importance: number | null): { label: string; color: typeof chalk.red } {
  const imp = importance ?? 0;
  if (imp >= 0.9) { return { label: 'CRITICAL', color: chalk.red }; }
  if (imp >= 0.7) { return { label: 'HIGH', color: chalk.yellow }; }
  if (imp >= 0.5) { return { label: 'MEDIUM', color: chalk.cyan }; }
  return { label: 'LOW', color: chalk.gray };
}

export const listFindingsCommand = new Command('list-findings')
  .description('Browse memory items by category (security, architecture, bugs, etc.)')
  .option('-c, --category <category>', 'Filter by category (e.g. security, architecture, bugs, conventions, decisions)')
  .option('-s, --status <status>', 'Filter by status: active (default), review, archived, all', 'active')
  .option('-l, --limit <number>', 'Max items to return (default 50, max 200)', '50')
  .option('--offset <number>', 'Pagination offset', '0')
  .option('--json', 'Output as raw JSON')
  .action(async (opts: {
    category?: string;
    status: string;
    limit: string;
    offset: string;
    json?: boolean;
  }) => {
    const projectConfig = findProjectConfig();
    const api = createApiClient();
    if (!api) { return; }

    if (!projectConfig) {
      console.error(chalk.red('✗'), 'No project configured. Run', chalk.cyan('contox init'), 'first.');
      process.exitCode = 1;
      return;
    }

    if (!(await verifyProjectAccess(api, projectConfig.projectId))) { return; }

    const limit = Math.min(Math.max(1, parseInt(opts.limit, 10) || 50), 200);
    const offset = Math.max(0, parseInt(opts.offset, 10) || 0);
    const schemaKey = opts.category ? `root/${opts.category}` : 'root/';

    try {
      const params = new URLSearchParams({
        projectId: projectConfig.projectId,
        schemaKey,
        limit: String(limit),
        offset: String(offset),
      });
      if (opts.status !== 'all') {
        params.set('status', opts.status);
      }

      const res = await api.get(`/api/v2/items?${params.toString()}`);
      if (!res.ok) {
        await handleApiError(res, 'Failed to fetch findings');
        return;
      }

      const data = await res.json() as ItemsResponse;

      if (opts.json) {
        process.stdout.write(JSON.stringify(data, null, 2) + '\n');
        return;
      }

      const catLabel = opts.category ? ` "${opts.category}"` : '';
      console.log(chalk.cyan.bold(`\n  Findings${catLabel}`));
      console.log(chalk.gray(`  ${String(data.items.length)} of ${String(data.total)} items (status: ${opts.status})\n`));

      if (data.items.length === 0) {
        console.log(chalk.gray('  No findings found.'));
        console.log('');
        return;
      }

      for (const item of data.items) {
        const { label, color } = getSeverity(item.importance);
        const conf = `${(item.confidence * 100).toFixed(0)}%`;
        console.log(`  ${color(`[${label}]`)} ${chalk.white.bold(item.title)}`);
        console.log(chalk.gray(`         confidence: ${conf} | ${item.schemaKey}`));
        if (item.files.length > 0) {
          console.log(chalk.gray(`         files: ${item.files.slice(0, 3).join(', ')}${item.files.length > 3 ? ` +${String(item.files.length - 3)} more` : ''}`));
        }
        console.log('');
      }

      if (data.hasMore) {
        console.log(chalk.gray(`  ...${String(data.total - data.items.length)} more items. Use --offset ${String(offset + limit)} to see next page.`));
        console.log('');
      }
    } catch (err) {
      console.error(chalk.red('✗'), 'Error:', (err as Error).message);
      process.exitCode = 1;
    }
  });
