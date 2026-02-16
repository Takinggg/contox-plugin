import { Command } from 'commander';
import chalk from 'chalk';
import { EvidenceCollector, toMcpSaveEvent } from '../lib/evidence-collector.js';
import { createV2Config, v2Ingest } from '../lib/v2-api.js';
import type { CollectorConfig } from '../lib/evidence-collector.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox collect — Collect session evidence and send to V2 ingest
 *
 * Gathers file changes, commit messages, and AI transcripts from the current
 * working directory. Converts them to an mcp_save event and sends to V2.
 *
 * Usage:
 *   contox collect                   # Collect & send to V2 ingest
 *   contox collect --dry-run         # Show what would be sent (no ingest)
 *   contox collect --json            # Output raw JSON to stdout
 *   contox collect --no-commits      # Skip commit messages
 *   contox collect --no-transcripts  # Skip Claude Code transcripts
 *   contox collect --since 2h        # Only commits from last 2 hours
 * ═══════════════════════════════════════════════════════════════════════════════ */

function parseSince(value: string): Date {
  const now = Date.now();
  const match = value.match(/^(\d+)\s*(h|hr|hours?|m|min|minutes?|d|days?)$/i);
  if (!match) {
    throw new Error(`Invalid --since format: "${value}". Use e.g. "2h", "30m", "1d".`);
  }

  const amount = parseInt(match[1]!, 10);
  const unit = match[2]!.charAt(0).toLowerCase();

  let ms: number;
  if (unit === 'h') { ms = amount * 3600_000; }
  else if (unit === 'm') { ms = amount * 60_000; }
  else { ms = amount * 86400_000; }

  return new Date(now - ms);
}

export const collectCommand = new Command('collect')
  .description('Collect session evidence (file changes, commits, transcripts) and send to V2')
  .option('--dry-run', 'Show what would be collected without sending to V2')
  .option('--json', 'Output raw collected evidence as JSON to stdout')
  .option('--no-commits', 'Skip commit message collection')
  .option('--no-transcripts', 'Skip Claude Code transcript collection')
  .option('--since <duration>', 'Only include commits since duration (e.g. 2h, 30m, 1d)')
  .option('--max-diff <size>', 'Max diff size per file in bytes (default: 10000)', '10000')
  .action(async (opts: {
    dryRun?: boolean;
    json?: boolean;
    commits: boolean;
    transcripts: boolean;
    since?: string;
    maxDiff?: string;
  }) => {
    const cwd = process.cwd();

    // Build collector config from CLI options
    const configOverrides: Partial<CollectorConfig> = {
      includeCommits: opts.commits !== false,
      includeTranscripts: opts.transcripts !== false,
    };

    if (opts.maxDiff) {
      configOverrides.maxDiffSize = parseInt(opts.maxDiff, 10);
    }

    if (opts.since) {
      const start = parseSince(opts.since);
      configOverrides.timeRange = { start, end: new Date() };
    }

    // Collect evidence
    const collector = new EvidenceCollector(cwd, configOverrides);

    if (!opts.json) {
      console.log(chalk.dim('\n  Collecting session evidence...\n'));
    }

    let collected;
    try {
      collected = await collector.collect();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  ✗ Collection failed: ${msg}`));
      process.exit(1);
    }

    // Summarize what was found
    const fileCount = collected.evidences.filter((e) => e.type === 'file_change').length;
    const commitCount = collected.evidences.filter((e) => e.type === 'commit_message').length;
    const transcriptCount = collected.evidences.filter((e) => e.type === 'transcript').length;

    if (!opts.json) {
      console.log(chalk.white('  Evidence collected:'));
      console.log(chalk.dim(`    Files changed:    ${chalk.white(String(fileCount))}`));
      console.log(chalk.dim(`    Commits:          ${chalk.white(String(commitCount))}`));
      console.log(chalk.dim(`    Transcripts:      ${chalk.white(String(transcriptCount))}`));
      console.log(chalk.dim(`    Branch:           ${chalk.white(collected.sessionMetadata.branch)}`));
      console.log(chalk.dim(`    Repository:       ${chalk.white(collected.sessionMetadata.repository)}`));
      console.log();
    }

    if (collected.evidences.length === 0) {
      if (!opts.json) {
        console.log(chalk.yellow('  ⚠ No evidence found. Nothing to send.'));
      }
      return;
    }

    // --json mode: output raw JSON and exit
    if (opts.json) {
      console.log(JSON.stringify(collected, null, 2));
      return;
    }

    // --dry-run mode: show mcp_save event preview
    if (opts.dryRun) {
      const event = toMcpSaveEvent(collected);
      console.log(chalk.dim('  Dry run — mcp_save event preview:\n'));
      console.log(chalk.dim(JSON.stringify(event, null, 2)));
      return;
    }

    // Send to V2 ingest
    const config = createV2Config();
    if (!config) {
      console.error(chalk.red('  ✗ Not configured. Run `contox login` and `contox init` first.'));
      process.exit(1);
    }

    const event = toMcpSaveEvent(collected);

    try {
      const result = await v2Ingest(config, event as unknown as Record<string, unknown>);
      console.log(chalk.green('  ✓ Evidence sent to V2 ingest'));
      console.log(chalk.dim(`    Event ID:    ${chalk.white(result.eventId)}`));
      console.log(chalk.dim(`    Session ID:  ${chalk.white(result.sessionId)}`));
      if (result.enrichmentJobId) {
        console.log(chalk.dim(`    Enrich Job:  ${chalk.white(result.enrichmentJobId)}`));
      }
      console.log();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`  ✗ Ingest failed: ${msg}`));
      process.exit(1);
    }
  });
