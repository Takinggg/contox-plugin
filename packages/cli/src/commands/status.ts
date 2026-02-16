import { Command } from 'commander';
import chalk from 'chalk';
import { createApiClient, handleApiError } from '../lib/api.js';
import type { ContextItem } from '../lib/api.js';
import { findProjectConfig } from '../lib/config.js';

export const statusCommand = new Command('status')
  .description('Show status of contexts in the current project')
  .option('-p, --project <projectId>', 'Project ID (overrides .contox.json)')
  .action(async (opts: { project?: string }) => {
    const api = createApiClient();
    if (!api) return;

    const projectConfig = findProjectConfig();
    const projectId = opts.project ?? projectConfig?.projectId;

    if (!projectId) {
      console.log(chalk.red('✗'), 'No project configured. Run', chalk.cyan('contox init'), 'first');
      return;
    }

    try {
      const res = await api.get(`/api/contexts?projectId=${projectId}`);

      if (!res.ok) {
        await handleApiError(res, 'Failed to fetch contexts');
        return;
      }

      const contexts = (await res.json()) as ContextItem[];

      if (contexts.length === 0) {
        console.log(chalk.yellow('\n  No contexts in this project.\n'));
        console.log(chalk.dim('  Push files with:'), chalk.cyan('contox push <files...>'));
        console.log('');
        return;
      }

      const projectName = projectConfig?.projectName ?? projectId;

      console.log(chalk.bold(`\n  ${projectName} — ${String(contexts.length)} Contexts\n`));
      console.log(
        chalk.dim(
          '  ' +
            'Name'.padEnd(30) +
            'Status'.padEnd(10) +
            'Tokens'.padEnd(10) +
            'Last Synced',
        ),
      );
      console.log(chalk.dim('  ' + '─'.repeat(70)));

      for (const ctx of contexts) {
        const statusColor =
          ctx.status === 'SYNCED'
            ? chalk.green
            : ctx.status === 'STALE'
              ? chalk.yellow
              : chalk.dim;

        const synced = ctx.lastSynced
          ? new Date(ctx.lastSynced).toLocaleString()
          : 'never';

        console.log(
          `  ${ctx.name.padEnd(30)}${statusColor(ctx.status.padEnd(10))}${String(ctx.tokens).padEnd(10)}${chalk.dim(synced)}`,
        );
      }

      console.log('');
    } catch (err) {
      console.log(chalk.red('✗'), 'Failed to fetch status:', (err as Error).message);
    }
  });
