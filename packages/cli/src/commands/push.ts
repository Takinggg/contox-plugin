import { Command } from 'commander';
import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import chalk from 'chalk';
import { createApiClient, handleApiError, verifyProjectAccess } from '../lib/api.js';
import type { ContextItem } from '../lib/api.js';
import { findProjectConfig } from '../lib/config.js';

export const pushCommand = new Command('push')
  .description('Push local files as contexts to Contox')
  .argument('<files...>', 'Files to push as contexts')
  .option('-p, --project <projectId>', 'Target project ID (overrides .contox.json)')
  .option('-t, --team <teamId>', 'Team ID (overrides .contox.json)')
  .action(async (files: string[], opts: { project?: string; team?: string }) => {
    const api = createApiClient();
    if (!api) return;

    const projectConfig = findProjectConfig();
    const teamId = opts.team ?? projectConfig?.teamId;
    const projectId = opts.project ?? projectConfig?.projectId;

    if (!teamId || !projectId) {
      console.log(chalk.red('✗'), 'No project configured. Run', chalk.cyan('contox init'), 'first');
      console.log(chalk.dim('  Or pass --team and --project flags.'));
      return;
    }

    // Pre-flight: verify access to the project
    if (!(await verifyProjectAccess(api, projectId))) { return; }

    // Fetch existing contexts to check for name matches
    let existingContexts: ContextItem[] = [];
    try {
      const res = await api.get(`/api/contexts?projectId=${encodeURIComponent(projectId)}`);
      if (res.ok) {
        existingContexts = (await res.json()) as ContextItem[];
      }
    } catch {
      // continue without existing context lookup
    }

    const contextsByName = new Map<string, ContextItem>();
    for (const ctx of existingContexts) {
      contextsByName.set(ctx.name, ctx);
    }

    let pushed = 0;
    let failed = 0;

    for (const file of files) {
      const filePath = resolve(file);
      if (!existsSync(filePath)) {
        console.log(chalk.red('✗'), `File not found: ${file}`);
        failed++;
        continue;
      }

      const content = readFileSync(filePath, 'utf-8');
      const name = basename(filePath);

      try {
        const existing = contextsByName.get(name);

        if (existing) {
          // Update existing context
          const res = await api.patch(`/api/contexts/${existing.id}`, { content });

          if (!res.ok) {
            await handleApiError(res, `Failed to update ${name}`);
            failed++;
            continue;
          }

          console.log(chalk.green('✓'), `Updated ${chalk.bold(name)}`, chalk.dim(`(${existing.id})`));
        } else {
          // Create new context
          const res = await api.post('/api/contexts', {
            name,
            teamId,
            projectId,
          });

          if (!res.ok) {
            await handleApiError(res, `Failed to create ${name}`);
            failed++;
            continue;
          }

          const created = (await res.json()) as ContextItem;

          // Set content via PATCH
          const patchRes = await api.patch(`/api/contexts/${created.id}`, { content });
          if (!patchRes.ok) {
            console.log(chalk.yellow('⚠'), `Created ${chalk.bold(name)} but failed to set content`);
          } else {
            console.log(chalk.green('✓'), `Pushed ${chalk.bold(name)}`, chalk.dim(`(${created.id})`));
          }
        }

        pushed++;
      } catch (err) {
        console.log(chalk.red('✗'), `Error pushing ${name}:`, (err as Error).message);
        failed++;
      }
    }

    console.log(
      chalk.dim(`\n  ${String(pushed)} pushed, ${String(failed)} failed\n`),
    );
  });
