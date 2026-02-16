import { Command } from 'commander';
import chalk from 'chalk';
import { createApiClient, handleApiError } from '../lib/api.js';
import type { ContextItem } from '../lib/api.js';
import { findProjectConfig } from '../lib/config.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox explain <schemaKey> — Deep-dive into any brain schemaKey
 *
 * Shows: metadata, content preview, links, entries, and related contracts.
 *
 * Usage:
 *   contox explain root/contracts/auth
 *   contox explain root/bugs
 *   contox explain root/patterns --json
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const explainCommand = new Command('explain')
  .description('Deep-dive into a brain schemaKey (metadata, content, links, entries)')
  .argument('<schemaKey>', 'The schemaKey to explain (e.g. "root/contracts/auth")')
  .option('--json', 'Output as JSON')
  .action(async (schemaKey: string, opts: { json?: boolean }) => {
    const projectConfig = findProjectConfig();
    const api = createApiClient();
    if (!api) { return; }

    if (!projectConfig) {
      console.error(chalk.red('✗'), 'No project configured. Run', chalk.cyan('contox init'), 'first.');
      process.exitCode = 1;
      return;
    }

    try {
      // Find context by schemaKey
      const res = await api.get(
        `/api/contexts?teamId=${encodeURIComponent(projectConfig.teamId)}&projectId=${encodeURIComponent(projectConfig.projectId)}&schemaKey=${encodeURIComponent(schemaKey)}`,
      );
      if (!res.ok) {
        await handleApiError(res, 'Failed to fetch context');
        return;
      }

      const contexts = (await res.json()) as ContextItem[];
      const ctx = contexts.find((c) => c.name.includes(schemaKey) || c.description?.includes(schemaKey));

      if (opts.json) {
        process.stdout.write(JSON.stringify({
          schemaKey,
          context: ctx ?? null,
          found: !!ctx,
        }, null, 2) + '\n');
        return;
      }

      console.log(chalk.cyan.bold(`\n  Explain: ${schemaKey}\n`));

      if (!ctx) {
        console.log(chalk.yellow('  No context found for this schemaKey in the current project.'));
        console.log(chalk.gray('  It may not be populated yet. Run'), chalk.cyan('npm run brain:gen-and-publish'));
        console.log('');
        return;
      }

      console.log(chalk.white.bold('  Context'));
      console.log(`  ID: ${chalk.gray(ctx.id)}`);
      console.log(`  Name: ${ctx.name}`);
      if (ctx.description) {
        console.log(`  Description: ${ctx.description}`);
      }
      console.log(`  Tokens: ${chalk.cyan(String(ctx.tokens ?? 0))}`);
      console.log(`  Last synced: ${ctx.lastSynced ?? 'never'}`);
      console.log('');

      // Show content preview
      if (ctx.description) {
        console.log(chalk.white.bold('  Content Preview'));
        const preview = ctx.description.length > 300
          ? ctx.description.slice(0, 300) + '...'
          : ctx.description;
        console.log(chalk.gray(`  ${preview}`));
        console.log('');
      }

      console.log(chalk.green('  ✓'), `Context found for ${chalk.cyan(schemaKey)}`);
      console.log('');
    } catch (err) {
      console.error(chalk.red('✗'), 'Error:', (err as Error).message);
      process.exitCode = 1;
    }
  });
