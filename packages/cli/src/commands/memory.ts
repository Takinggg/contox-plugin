import { Command } from 'commander';
import chalk from 'chalk';
import { createV2Config, v2GetBrain } from '../lib/v2-api.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox memory — Load the full project memory via V2 brain
 *
 * Universal command that works with ANY AI tool (Claude, Cursor, Copilot, etc.)
 * Outputs the V2 brain document as structured markdown to stdout.
 *
 * Usage:
 *   contox memory                → print full memory to stdout
 *   contox memory --brief        → print only the project brief (Layer 0)
 *   contox memory --budget 3000  → request a smaller brain document
 *   contox memory --layers       → show layer statistics
 *   contox memory -o mem.md      → save to file
 *   contox memory --json         → output as JSON
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const memoryCommand = new Command('memory')
  .description('Load the full project memory (use at session start)')
  .option('-o, --output <file>', 'Save memory to a file instead of stdout')
  .option('--json', 'Output as JSON instead of markdown')
  .option('--brief', 'Output only the project brief (Layer 0 summary)')
  .option('--budget <tokens>', 'Token budget for brain document (default: 6000)', parseInt)
  .option('--layers', 'Show layer statistics')
  .option('-q, --quiet', 'Suppress info messages (only output memory)')
  .action(async (opts: {
    output?: string;
    json?: boolean;
    brief?: boolean;
    budget?: number;
    layers?: boolean;
    quiet?: boolean;
  }) => {
    const config = createV2Config();
    if (!config) {
      console.error(chalk.red('✗'), 'Not configured. Run', chalk.cyan('contox login'), '&&', chalk.cyan('contox init'));
      process.exitCode = 1;
      return;
    }

    try {
      const brain = await v2GetBrain(config, opts.budget ? { tokenBudget: opts.budget } : undefined);

      // --brief: output only the summary
      if (opts.brief) {
        if (brain.summary) {
          process.stdout.write(brain.summary + '\n');
        } else {
          console.error(chalk.yellow('⚠'), 'No project brief available yet. Run enrichment first.');
        }
        return;
      }

      // --layers: show layer statistics
      if (opts.layers) {
        console.log(chalk.bold('Layer Statistics:'));
        if (brain.layers) {
          console.log(`  ${chalk.cyan('Layer 0')} (Project Brief):  synthesized`);
          console.log(`  ${chalk.green('Layer 1')} (Active):         ${String(brain.layers.layer1)} items`);
          console.log(`  ${chalk.blue('Layer 2')} (Reference):      ${String(brain.layers.layer2)} items`);
          console.log(`  ${chalk.dim('Layer 3')} (Archived):       ${String(brain.layers.archived)} items`);
          console.log(`  ${chalk.bold('Total loaded')}: ${String(brain.itemsLoaded)} items (~${String(brain.tokenEstimate)} tokens)`);
        } else {
          console.log(`  Total: ${String(brain.itemsLoaded)} items (~${String(brain.tokenEstimate)} tokens)`);
        }
        return;
      }

      // --json: full JSON output
      if (opts.json) {
        process.stdout.write(JSON.stringify({
          document: brain.document,
          summary: brain.summary,
          itemsLoaded: brain.itemsLoaded,
          tokenEstimate: brain.tokenEstimate,
          brainHash: brain.brainHash,
          layers: brain.layers,
        }, null, 2) + '\n');
        return;
      }

      // Default: output markdown document
      if (opts.output) {
        const { writeFileSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        writeFileSync(resolve(opts.output), brain.document, 'utf-8');
        if (!opts.quiet) {
          console.error(chalk.green('✓'), `Memory saved to ${chalk.cyan(opts.output)} (${String(brain.itemsLoaded)} items)`);
        }
      } else {
        process.stdout.write(brain.document);
      }

      if (!opts.quiet && !opts.output) {
        const layers = brain.layers
          ? ` | L1: ${String(brain.layers.layer1)}, L2: ${String(brain.layers.layer2)}, archived: ${String(brain.layers.archived)}`
          : '';
        console.error(chalk.dim(`\n--- ${String(brain.itemsLoaded)} items loaded (~${String(brain.tokenEstimate)} tokens)${layers} ---`));
      }
    } catch (err) {
      console.error(chalk.red('✗'), 'Error:', (err as Error).message);
      process.exitCode = 1;
    }
  });
