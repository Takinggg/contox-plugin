/* ═══════════════════════════════════════════════════════════════════════════════
 * CLI: contox context — Build a context pack via V2 API
 *
 * Fetches the brain document and optionally performs semantic search
 * to build a focused context pack. Outputs markdown to stdout.
 *
 * Usage:
 *   contox context --task "implement auth" --scope relevant --budget 4000
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { Command } from 'commander';
import chalk from 'chalk';

import { createV2Config, v2GetBrain, v2Search } from '../lib/v2-api.js';
import type { BrainResponse, SearchResponse } from '../lib/v2-api.js';

export const contextCommand = new Command('context')
  .description('Build a context pack for a task (V2)')
  .option('--task <task>', 'Task description for semantic search')
  .option('--scope <scope>', 'Scope: full, relevant, minimal', 'relevant')
  .option('--budget <tokens>', 'Token budget', '4000')
  .action(async (opts: { task?: string; scope: string; budget: string }) => {
    const config = createV2Config();
    if (!config) {
      console.error(chalk.red('Not configured. Run: contox login && contox init'));
      process.exit(1);
    }

    const budget = parseInt(opts.budget, 10);

    try {
      if (opts.scope === 'full' || !opts.task) {
        // Full brain document
        const brain = await v2GetBrain(config);
        const maxChars = budget * 4;

        if (brain.document.length <= maxChars) {
          process.stdout.write(brain.document);
        } else {
          process.stdout.write(brain.document.slice(0, maxChars));
          process.stdout.write('\n\n_[truncated to fit budget]_\n');
        }

        console.error(chalk.dim(`\n--- ${brain.itemsLoaded} items, ~${brain.tokenEstimate} tokens ---`));
        return;
      }

      // Relevant: semantic search
      let searchData: SearchResponse;
      try {
        searchData = await v2Search(config, opts.task, { limit: 15, minSimilarity: 0.6 });
      } catch {
        // Fallback to full brain
        console.error(chalk.dim('Search unavailable, falling back to full brain'));
        const brain = await v2GetBrain(config);
        process.stdout.write(brain.document.slice(0, budget * 4));
        return;
      }

      if (searchData.results.length === 0) {
        console.error(chalk.dim('No relevant results, showing top items'));
        const brain = await v2GetBrain(config);
        process.stdout.write(brain.document.slice(0, budget * 4));
        return;
      }

      // Build context pack from search results
      const parts: string[] = [];
      parts.push('# Context Pack\n');
      parts.push(`> Task: ${opts.task}`);
      parts.push(`> ${searchData.results.length} relevant items (${searchData.totalCandidates} candidates)\n`);

      for (const r of searchData.results) {
        const section = [
          `### ${r.title}`,
          `> ${r.type} | sim: ${r.similarity.toFixed(3)} | conf: ${r.confidence.toFixed(2)}`,
          r.files.length > 0 ? `> files: ${r.files.slice(0, 5).join(', ')}` : '',
          '',
          r.facts,
          '',
        ].filter(Boolean).join('\n');

        if (estimateTokens(parts.join('\n') + section) > budget) {
          break;
        }
        parts.push(section);
      }

      process.stdout.write(parts.join('\n'));
      console.error(chalk.dim(`\n--- ~${estimateTokens(parts.join('\n'))} tokens ---`));
    } catch (err) {
      console.error(chalk.red(`Error: ${String(err)}`));
      process.exit(1);
    }
  });

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
