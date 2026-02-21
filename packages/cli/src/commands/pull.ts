import { Command } from 'commander';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { createApiClient, handleApiError, verifyProjectAccess } from '../lib/api.js';
import type { ContextItem } from '../lib/api.js';
import { findProjectConfig } from '../lib/config.js';

interface ContextDetail {
  id: string;
  name: string;
  content: string | null;
  tokens: number;
}

export const pullCommand = new Command('pull')
  .description('Pull contexts from Contox to local files')
  .option('-o, --out <dir>', 'Output directory', '.')
  .option('-p, --project <projectId>', 'Project ID (overrides .contox.json)')
  .action(async (opts: { out: string; project?: string }) => {
    const api = createApiClient();
    if (!api) return;

    const projectConfig = findProjectConfig();
    const projectId = opts.project ?? projectConfig?.projectId;

    if (!projectId) {
      console.log(chalk.red('✗'), 'No project configured. Run', chalk.cyan('contox init'), 'first');
      return;
    }

    // Pre-flight: verify access to the project
    if (!(await verifyProjectAccess(api, projectId))) { return; }

    try {
      const res = await api.get(`/api/contexts?projectId=${encodeURIComponent(projectId)}`);

      if (!res.ok) {
        await handleApiError(res, 'Failed to fetch contexts');
        return;
      }

      const contexts = (await res.json()) as ContextItem[];

      if (contexts.length === 0) {
        console.log(chalk.yellow('No contexts to pull.'));
        return;
      }

      const outDir = resolve(opts.out);
      mkdirSync(outDir, { recursive: true });

      let pulled = 0;

      for (const ctx of contexts) {
        // Fetch full context with content
        const detailRes = await api.get(`/api/contexts/${ctx.id}`);
        if (!detailRes.ok) {
          console.log(chalk.red('✗'), `Failed to fetch ${ctx.name}`);
          continue;
        }

        const detail = (await detailRes.json()) as ContextDetail;

        if (!detail.content) {
          console.log(chalk.dim('  ─'), `${ctx.name}`, chalk.dim('(empty, skipped)'));
          continue;
        }

        const fileName = ctx.name.endsWith('.md') ? ctx.name : `${ctx.name}.md`;
        const filePath = join(outDir, fileName);
        writeFileSync(filePath, detail.content, 'utf-8');
        console.log(chalk.green('✓'), `Pulled ${chalk.bold(fileName)}`, chalk.dim(`(${String(detail.tokens)} tokens)`));
        pulled++;
      }

      console.log(chalk.dim(`\n  ${String(pulled)} files written to ${outDir}\n`));
    } catch (err) {
      console.log(chalk.red('✗'), 'Failed to pull:', (err as Error).message);
    }
  });
