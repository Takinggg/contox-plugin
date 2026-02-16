import { Command } from 'commander';
import { basename } from 'node:path';
import chalk from 'chalk';
import { createV2Config, v2Ingest, v2GetBrain } from '../lib/v2-api.js';
import { createApiClient } from '../lib/api.js';
import { updateClaudeMd } from '../lib/claude-md.js';
import {
  getProjectHash,
  findActiveTranscript,
  readCursor,
  writeCursor,
  readTranscriptDelta,
  extractFacts,
  factsToSessionInput,
} from '../lib/transcript.js';
import type { SaveCursor } from '../lib/transcript.js';

/* ═══════════════════════════════════════════════════════════════════════════════
 * contox save — Save a session's work via V2 ingest pipeline
 *
 * Universal command that works with ANY AI tool (Claude, Cursor, Copilot, etc.)
 * The AI calls this at the end of each session to persist what was done.
 *
 * Usage:
 *   contox save "Built auth system with JWT"
 *   contox save --json < session.json
 *   echo '{"summary":"...","changes":[...]}' | contox save --json
 * ═══════════════════════════════════════════════════════════════════════════════ */

const VALID_CATEGORIES = ['architecture', 'conventions', 'implementation', 'decisions', 'bugs', 'todo'] as const;

interface SessionChange {
  category: string;
  title: string;
  content: string;
}

interface SessionInput {
  summary: string;
  changes: SessionChange[];
}

export const saveCommand = new Command('save')
  .description('Save session work into project memory (use at session end)')
  .argument('[summary...]', 'Session summary (what was accomplished)')
  .option('--json', 'Read structured JSON from stdin: { summary, changes: [{ category, title, content }] }')
  .option('--auto', 'Auto-extract session data from Claude Code transcript (for hooks)')
  .option('-c, --category <cat>', 'Category for simple saves (default: implementation)', 'implementation')
  .action(async (summaryParts: string[], opts: { json?: boolean; auto?: boolean; category?: string }) => {
    const config = createV2Config();
    if (!config) {
      console.error(chalk.red('✗'), 'Not configured. Run', chalk.cyan('contox login'), '&&', chalk.cyan('contox init'));
      process.exitCode = 1;
      return;
    }

    let input: SessionInput;
    let cursorUpdate: SaveCursor | null = null;

    if (opts.auto) {
      // ── Auto-save: read Claude Code transcript ──
      const autoResult = await buildAutoInput();
      if (!autoResult) {
        return;
      }
      input = autoResult.input;
      cursorUpdate = autoResult.cursor;
    } else if (opts.json) {
      // Read structured JSON from stdin
      const stdinData = await readStdin();
      try {
        input = JSON.parse(stdinData) as SessionInput;
      } catch {
        console.error(chalk.red('✗'), 'Invalid JSON input. Expected: { "summary": "...", "changes": [...] }');
        process.exitCode = 1;
        return;
      }

      if (!input.summary || !Array.isArray(input.changes)) {
        console.error(chalk.red('✗'), 'JSON must have "summary" (string) and "changes" (array).');
        process.exitCode = 1;
        return;
      }
    } else {
      // Simple mode: summary as argument
      const summary = summaryParts.join(' ');
      if (!summary) {
        console.error(chalk.red('✗'), 'Please provide a session summary.');
        console.error(chalk.dim('  Usage: contox save "Built auth system with JWT middleware"'));
        console.error(chalk.dim('  Or:    echo \'{"summary":"...","changes":[...]}\' | contox save --json'));
        process.exitCode = 1;
        return;
      }

      const category = opts.category ?? 'implementation';
      if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
        console.error(chalk.red('✗'), `Invalid category "${category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      input = {
        summary,
        changes: [{
          category,
          title: summary.slice(0, 80),
          content: summary,
        }],
      };
    }

    if (!opts.json) {
      console.log(chalk.bold('\n  Contox Save Session\n'));
    }

    try {
      // Send via V2 ingest pipeline
      const result = await v2Ingest(config, {
        type: 'mcp_save',
        summary: input.summary,
        changes: input.changes,
      });

      // Output results
      if (opts.json) {
        process.stdout.write(JSON.stringify({
          eventId: result.eventId,
          sessionId: result.sessionId,
          enrichmentJobId: result.enrichmentJobId,
          status: result.status,
        }, null, 2) + '\n');
      } else {
        console.log(`  ${chalk.green('✓')} Session saved via V2 pipeline`);
        console.log(`  ${chalk.dim('Event ID:')} ${result.eventId}`);
        console.log(`  ${chalk.dim('Session:')} ${result.sessionId}`);
        console.log(`  ${chalk.dim('Enrichment:')} ${result.enrichmentJobId ?? 'queued'}`);
        console.log(`  ${chalk.dim('Changes will be enriched, embedded, and deduplicated asynchronously.\n')}`);
      }

      // Post-save: update cursor for auto-save mode
      if (cursorUpdate) {
        writeCursor(process.cwd(), cursorUpdate);
      }

      // Post-save: update CLAUDE.md (non-critical, prefer V2 brain with V1 fallback)
      const api = createApiClient();
      if (api) {
        let brainDoc: string | undefined;
        try {
          const brain = await v2GetBrain(config);
          brainDoc = brain.document;
        } catch {
          // V2 brain unavailable — will fall back to V1 in updateClaudeMd
        }
        await updateClaudeMd(process.cwd(), api, config.teamId, config.projectId, brainDoc).catch(() => {});
      }
    } catch (err) {
      console.error(chalk.red('✗'), 'Error:', (err as Error).message);
      process.exitCode = 1;
    }
  });

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => { resolve(data); });

    // If stdin is a TTY (no piped input), resolve immediately
    if (process.stdin.isTTY) {
      resolve('');
    }
  });
}

async function buildAutoInput(): Promise<{ input: SessionInput; cursor: SaveCursor } | null> {
  const cwd = process.cwd();
  const hash = getProjectHash(cwd);
  const transcriptPath = findActiveTranscript(hash);

  if (!transcriptPath) {
    console.log(chalk.dim('  [auto-save] No Claude Code transcript found, skipping.'));
    return null;
  }

  const cursor = readCursor(cwd);
  const sessionId = basename(transcriptPath, '.jsonl');

  // If cursor is from a different session, start from 0
  const startOffset = (cursor?.sessionId === sessionId) ? cursor.byteOffset : 0;

  const { lines, newOffset } = await readTranscriptDelta(transcriptPath, startOffset);

  if (lines.length === 0) {
    console.log(chalk.dim('  [auto-save] No new transcript data since last save.'));
    return null;
  }

  const facts = extractFacts(lines);

  // Skip if contox_save_session was already called in this delta
  if (facts.contoxSaveCalled) {
    console.log(chalk.dim('  [auto-save] Already saved via MCP tool in this segment, skipping.'));
    // Still update cursor to not re-process this segment
    writeCursor(cwd, { sessionId, byteOffset: newOffset, savedAt: new Date().toISOString() });
    return null;
  }

  // Skip if no meaningful activity detected
  if (facts.filesModified.size === 0 && facts.commandsRun.length === 0 && facts.userRequests.length === 0) {
    console.log(chalk.dim('  [auto-save] No meaningful activity detected, skipping.'));
    return null;
  }

  const input = factsToSessionInput(facts);
  const cursorData: SaveCursor = {
    sessionId,
    byteOffset: newOffset,
    savedAt: new Date().toISOString(),
  };

  console.log(chalk.bold('\n  Contox Auto-Save\n'));
  console.log(chalk.dim(`  Transcript: ${sessionId.slice(0, 8)}...`));
  console.log(chalk.dim(`  Delta: ${String(lines.length)} messages since offset ${String(startOffset)}`));
  console.log(chalk.dim(`  Files modified: ${String(facts.filesModified.size)}, Commands: ${String(facts.commandsRun.length)}`));
  console.log('');

  return { input, cursor: cursorData };
}
