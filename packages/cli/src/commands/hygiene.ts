import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { createV2Config, v2AnalyzeHygiene, v2ApplyHygiene } from '../lib/v2-api.js';

import type { HygieneAnalyzeResponse } from '../lib/v2-api.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox hygiene — Memory hygiene agent
 *
 * Analyze memory items for quality issues and propose cleanup actions.
 * Two-phase: analyze → review → apply.
 *
 * Usage:
 *   contox hygiene                          → quick analysis (20 items)
 *   contox hygiene --mode weekly            → last 7 days
 *   contox hygiene --schema-key root/bugs   → filter by schemaKey
 *   contox hygiene --json                   → JSON output
 *   contox hygiene --apply plan.json        → apply from saved plan
 *   contox hygiene --apply plan.json --dry-run → preview apply
 * ═══════════════════════════════════════════════════════════════════════════════ */

export const hygieneCommand = new Command('hygiene')
  .description('Run memory hygiene agent (analyze + apply cleanup actions)')
  .option('--mode <mode>', 'Analysis mode: quick (20 items) or weekly (7 days)', 'quick')
  .option('--schema-key <prefix>', 'Filter items by schemaKey prefix')
  .option('--json', 'Output raw JSON')
  .option('--apply <file>', 'Apply actions from a saved plan JSON file')
  .option('--action-ids <ids>', 'Comma-separated action IDs to apply (default: all non-approval-required)')
  .option('--dry-run', 'Preview what would be applied without executing')
  .action(async (opts: {
    mode?: string;
    schemaKey?: string;
    json?: boolean;
    apply?: string;
    actionIds?: string;
    dryRun?: boolean;
  }) => {
    const config = createV2Config();
    if (!config) {
      console.error(chalk.red('✗'), 'Not configured. Run', chalk.cyan('contox init'), 'first.');
      process.exitCode = 1;
      return;
    }

    try {
      // ── Apply mode ──────────────────────────────────────────────────────
      if (opts.apply) {
        let plan: HygieneAnalyzeResponse;
        try {
          const raw = readFileSync(opts.apply, 'utf-8');
          plan = JSON.parse(raw) as HygieneAnalyzeResponse;
        } catch (err) {
          console.error(chalk.red('✗'), 'Failed to read plan file:', (err as Error).message);
          process.exitCode = 1;
          return;
        }

        // Determine which actions to apply
        let selectedIds: string[];
        if (opts.actionIds) {
          selectedIds = opts.actionIds.split(',').map((s) => s.trim());
        } else {
          // Default: apply all actions that don't require human approval
          selectedIds = plan.actions
            .filter((a) => !a.requiresHumanApproval)
            .map((a) => a.actionId);
        }

        if (selectedIds.length === 0) {
          console.log(chalk.yellow('⚠'), 'No actions to apply (all require human approval).');
          console.log('  Use --action-ids to explicitly select actions.');
          return;
        }

        const dryRun = opts.dryRun ?? false;
        console.log(
          chalk.cyan('→'),
          `Applying ${String(selectedIds.length)} actions${dryRun ? ' (dry run)' : ''}...`,
        );

        const result = await v2ApplyHygiene(config, {
          plan,
          selectedActionIds: selectedIds,
          dryRun,
        });

        if (opts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
          return;
        }

        console.log('');
        console.log(chalk.green('✓'), `Applied: ${String(result.appliedActionIds.length)}`);
        if (result.skippedActionIds.length > 0) {
          console.log(chalk.yellow('○'), `Skipped: ${String(result.skippedActionIds.length)}`);
        }
        if (result.errors.length > 0) {
          console.log(chalk.red('✗'), `Errors: ${String(result.errors.length)}`);
          for (const err of result.errors) {
            console.log(`    ${chalk.red(err.actionId)}: ${err.message}`);
          }
        }
        return;
      }

      // ── Analyze mode ────────────────────────────────────────────────────
      const mode = (opts.mode === 'weekly' ? 'weekly' : 'quick') as 'quick' | 'weekly';

      console.log(chalk.cyan('→'), `Analyzing memories (${mode} mode)...`);

      const report = await v2AnalyzeHygiene(config, {
        mode,
        schemaKeyPrefix: opts.schemaKey,
      });

      if (opts.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        return;
      }

      // Pretty output
      console.log('');
      console.log(chalk.cyan.bold('  Memory Hygiene Report') + chalk.gray(` (${mode} mode)`));
      console.log(chalk.gray('  ' + '─'.repeat(40)));
      console.log(`  Items analyzed: ${chalk.cyan(String(report.metrics.totalMemories))}`);
      console.log(`  Actions proposed: ${chalk.cyan(String(report.metrics.actionsCount))}`);
      console.log(
        `  Tokens: ${chalk.gray(String(report.usage.promptTokens) + '+' + String(report.usage.completionTokens))}`,
      );
      console.log('');
      console.log(`  ${report.summary}`);

      if (report.warnings.length > 0) {
        console.log('');
        console.log(chalk.yellow.bold('  Warnings:'));
        for (const w of report.warnings) {
          console.log(`    ${chalk.yellow('⚠')} ${w}`);
        }
      }

      if (report.actions.length === 0) {
        console.log('');
        console.log(chalk.green('  ✓ No issues found — memory is clean!'));
        return;
      }

      // Group actions by type
      const byType = new Map<string, typeof report.actions>();
      for (const action of report.actions) {
        const list = byType.get(action.type) ?? [];
        list.push(action);
        byType.set(action.type, list);
      }

      console.log('');
      for (const [type, actions] of byType) {
        const typeColor = getTypeColor(type);
        console.log(typeColor(`  ${type} (${String(actions.length)})`));

        for (const a of actions) {
          const approvalTag = a.requiresHumanApproval
            ? chalk.red(' [NEEDS APPROVAL]')
            : '';
          const conf = a.confidence >= 0.9
            ? chalk.green(a.confidence.toFixed(2))
            : a.confidence >= 0.7
              ? chalk.yellow(a.confidence.toFixed(2))
              : chalk.red(a.confidence.toFixed(2));

          console.log(`    ${chalk.white('•')} ${a.reason} (${conf})${approvalTag}`);
          console.log(
            chalk.gray(`      id: ${a.actionId} | targets: ${a.targetMemoryIds.join(', ')}`),
          );
        }
        console.log('');
      }

      // Save hint
      console.log(
        chalk.gray('  Save this report with:'),
        chalk.cyan('contox hygiene --json > plan.json'),
      );
      console.log(
        chalk.gray('  Apply safe actions:'),
        chalk.cyan('contox hygiene --apply plan.json'),
      );
      console.log(
        chalk.gray('  Preview first:'),
        chalk.cyan('contox hygiene --apply plan.json --dry-run'),
      );
      console.log('');
    } catch (err) {
      console.error(chalk.red('✗'), 'Error:', (err as Error).message);
      process.exitCode = 1;
    }
  });

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTypeColor(type: string): (s: string) => string {
  switch (type) {
    case 'RENAME_TITLE':
    case 'RETAG':
    case 'FIX_DEDUPHINT':
      return chalk.blue.bold;
    case 'MERGE_MEMORIES':
      return chalk.magenta.bold;
    case 'DEPRECATE_MEMORY':
      return chalk.red.bold;
    case 'NEEDS_EVIDENCE':
    case 'PATCH_FACTS':
    case 'PATCH_RATIONALE':
      return chalk.yellow.bold;
    case 'REDACT':
      return chalk.red.bold;
    case 'LINK_RELATED':
      return chalk.cyan.bold;
    default:
      return chalk.white.bold;
  }
}
