/* ═══════════════════════════════════════════════════════════════════════════════
 * CLI: contox sync — Sync all AI agent config files with project memory
 *
 * Detects which AI tools are present in the workspace and updates their
 * config files with the latest project brief + memory protocol.
 *
 * Files updated:
 *   CLAUDE.md                        (Claude Code)
 *   .cursorrules                     (Cursor)
 *   .windsurfrules                   (Windsurf)
 *   .clinerules                      (Cline)
 *   .github/copilot-instructions.md  (GitHub Copilot)
 *
 * Also optionally generates Claude Code hooks for auto-injection.
 *
 * Usage:
 *   contox sync                    # Sync all detected agents
 *   contox sync --dry-run          # Preview without writing
 *   contox sync --targets claude,cursor  # Only specific agents
 *   contox sync --hooks            # Also generate Claude Code hooks
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import chalk from 'chalk';

import { createV2Config, v2GetBrain } from '../lib/v2-api.js';

const MARKER_START = '<!-- contox:start -->';
const MARKER_END = '<!-- contox:end -->';

interface AgentTarget {
  id: string;
  name: string;
  relPath: string;
  /** Create if this directory exists (even if the file doesn't) */
  dirHint?: string;
  /** Whether this agent can use MCP tools */
  hasMcp: boolean;
}

const ALL_TARGETS: AgentTarget[] = [
  { id: 'claude', name: 'Claude Code', relPath: 'CLAUDE.md', hasMcp: true },
  { id: 'cursor', name: 'Cursor', relPath: '.cursorrules', dirHint: '.cursor', hasMcp: true },
  { id: 'copilot', name: 'GitHub Copilot', relPath: '.github/copilot-instructions.md', dirHint: '.github', hasMcp: true },
  { id: 'windsurf', name: 'Windsurf', relPath: '.windsurfrules', hasMcp: true },
  { id: 'cline', name: 'Cline', relPath: '.clinerules', hasMcp: true },
  { id: 'aider', name: 'Aider', relPath: '.aider.conf.yml', hasMcp: false },
  { id: 'continue', name: 'Continue', relPath: '.continuerules', hasMcp: false },
];

// ── Section builders ──────────────────────────────────────────────────────

function buildMcpSection(brainSummary?: string): string {
  const lines: string[] = [];

  lines.push('# Contox — Auto-generated Project Context');
  lines.push('');
  lines.push('> This section is auto-managed by Contox. Do not edit between the markers.');
  lines.push('> Your own content outside the markers is preserved.');
  lines.push('');
  lines.push('## Memory Protocol');
  lines.push('');
  lines.push('### Session Start');
  lines.push('- Call `contox_get_memory` to load project context from previous sessions');
  lines.push('');
  lines.push('### During Session');
  lines.push('- Use all Contox tools freely to read/write data (create contexts, update, search, scan, etc.)');
  lines.push('- **BEFORE modifying any file**: call `contox_context_pack` with a brief task description');
  lines.push('  to get architecture decisions, conventions, and known issues relevant to your work');
  lines.push('- Use `contox_search "topic"` to find specific memory items');
  lines.push('- Use `contox_ask "question"` for natural-language questions about the project');
  lines.push('- This pushes information to the Contox platform in real-time');
  lines.push('');
  lines.push('### Saving — USER-INITIATED ONLY');
  lines.push('- **NEVER** call `contox_save_session` automatically or proactively');
  lines.push('- Only save when the user explicitly asks (e.g. "save", "save session", "contox save")');
  lines.push('- The user may be working on multiple tasks in parallel — auto-saving could mix contexts');
  lines.push('');

  if (brainSummary) {
    lines.push(brainSummary);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function buildFileFallbackSection(brainSummary?: string, brainDocument?: string): string {
  const lines: string[] = [];

  lines.push('# Contox — Auto-generated Project Context');
  lines.push('');
  lines.push('> This section is auto-managed by Contox. Do not edit between the markers.');
  lines.push('');
  lines.push('## MANDATORY: Read memory at session start');
  lines.push('- Read `.contox/memory.md` BEFORE starting any work');
  lines.push('- This is your primary source of truth about this project');
  lines.push('- Do NOT ask questions that are already answered in the memory');
  lines.push('');
  lines.push('## Active file context');
  lines.push('- `.contox/context.md` contains focused context relevant to your current file');
  lines.push('');
  lines.push('## Save your work at session end');
  lines.push('- Run: `contox save "Brief summary of what you did"`');
  lines.push('- Categories: architecture, conventions, implementation, decisions, bugs, todo');
  lines.push('');

  if (brainSummary) {
    lines.push(brainSummary);
    lines.push('');
  } else if (brainDocument) {
    // Truncate to ~4K tokens for non-MCP agents that can't call tools
    const maxChars = 4000 * 4;
    const doc = brainDocument.length > maxChars
      ? brainDocument.slice(0, maxChars) + '\n\n_[truncated — run `contox memory` for full context]_'
      : brainDocument;
    lines.push(doc);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

// ── Marker-based merge ────────────────────────────────────────────────────

function mergeSection(existing: string, section: string): string {
  const wrapped = `${MARKER_START}\n${section}\n${MARKER_END}`;

  if (!existing.trim()) {
    return wrapped + '\n';
  }

  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);

  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + MARKER_END.length);
    return before + wrapped + after;
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return existing + separator + wrapped + '\n';
}

// ── Claude Code hooks generation ──────────────────────────────────────────

interface HooksConfig {
  hooks: {
    SessionStart?: Array<{ type: string; command: string }>;
    PreToolUse?: Array<{ type: string; matcher: string; command: string }>;
  };
}

function buildClaudeHooksConfig(): HooksConfig {
  return {
    hooks: {
      SessionStart: [
        {
          type: 'command',
          command: 'contox context --scope minimal --budget 1000 --task "session start overview" 2>/dev/null || true',
        },
      ],
      PreToolUse: [
        {
          type: 'command',
          matcher: 'Read',
          command: 'contox context --scope relevant --budget 500 --task "reading file" 2>/dev/null || true',
        },
      ],
    },
  };
}

// ── Main command ──────────────────────────────────────────────────────────

interface SyncOpts {
  dryRun?: boolean;
  targets?: string;
  hooks?: boolean;
}

export const syncCommand = new Command('sync')
  .description('Sync all AI agent config files with project memory')
  .option('--dry-run', 'Preview changes without writing files')
  .option('--targets <agents>', 'Comma-separated list of agents (claude,cursor,copilot,windsurf,cline,aider,continue)')
  .option('--hooks', 'Also generate Claude Code hooks for auto-injection')
  .action(async (opts: SyncOpts) => {
    const config = createV2Config();
    if (!config) {
      console.error(chalk.red('✗'), 'Not configured. Run', chalk.cyan('contox login'), '&&', chalk.cyan('contox init'));
      process.exitCode = 1;
      return;
    }

    const cwd = process.cwd();
    const dryRun = opts.dryRun ?? false;

    // ── 1. Fetch brain ──
    console.error(chalk.dim('Fetching project memory...'));
    let brainSummary: string | undefined;
    let brainDocument: string | undefined;

    try {
      const brain = await v2GetBrain(config);
      brainSummary = brain.summary || undefined;
      brainDocument = brain.document || undefined;

      const tokenEst = Math.ceil((brainSummary ?? brainDocument ?? '').length / 4);
      console.error(
        chalk.green('✓'),
        `Brain loaded (${String(brain.itemsLoaded)} items, ~${String(tokenEst)} token summary)`,
      );
    } catch (err) {
      console.error(
        chalk.yellow('⚠'),
        `Brain unavailable: ${(err as Error).message}. Syncing protocol only.`,
      );
    }

    // ── 2. Determine targets ──
    let targets = ALL_TARGETS;
    if (opts.targets) {
      const requested = new Set(opts.targets.split(',').map((s) => s.trim().toLowerCase()));
      targets = ALL_TARGETS.filter((t) => requested.has(t.id));
      if (targets.length === 0) {
        console.error(chalk.red('✗'), 'No valid targets. Available:', ALL_TARGETS.map((t) => t.id).join(', '));
        process.exitCode = 1;
        return;
      }
    }

    // ── 3. Sync each target ──
    const updated: string[] = [];
    const skipped: string[] = [];

    for (const target of targets) {
      const filePath = join(cwd, target.relPath);
      const fileExists = existsSync(filePath);
      const dirExists = target.dirHint
        ? existsSync(join(cwd, target.dirHint))
        : false;

      // CLAUDE.md and copilot are always synced; others only if detected
      const alwaysSync = target.id === 'claude';
      if (!alwaysSync && !fileExists && !dirExists) {
        skipped.push(target.name);
        continue;
      }

      // Build content
      const section = target.hasMcp
        ? buildMcpSection(brainSummary)
        : buildFileFallbackSection(brainSummary, brainDocument);

      let existing = '';
      try {
        existing = await readFile(filePath, 'utf-8');
      } catch {
        // File doesn't exist
      }

      const merged = mergeSection(existing, section);

      if (dryRun) {
        console.log(chalk.cyan(`[dry-run] Would update: ${target.relPath}`));
        updated.push(target.name);
        continue;
      }

      try {
        const parentDir = dirname(filePath);
        if (!existsSync(parentDir)) {
          await mkdir(parentDir, { recursive: true });
        }
        await writeFile(filePath, merged, 'utf-8');
        updated.push(target.name);
      } catch (err) {
        console.error(chalk.red('✗'), `Failed to write ${target.relPath}: ${(err as Error).message}`);
      }
    }

    // ── 4. Claude Code hooks (optional) ──
    if (opts.hooks) {
      const hooksDir = join(cwd, '.claude');
      const hooksPath = join(hooksDir, 'settings.json');

      if (dryRun) {
        console.log(chalk.cyan('[dry-run] Would create: .claude/settings.json (hooks)'));
      } else {
        try {
          if (!existsSync(hooksDir)) {
            await mkdir(hooksDir, { recursive: true });
          }

          // Merge hooks into existing settings if present
          let existingSettings: Record<string, unknown> = {};
          try {
            const raw = await readFile(hooksPath, 'utf-8');
            existingSettings = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            // No existing settings
          }

          const hooksConfig = buildClaudeHooksConfig();
          const merged = { ...existingSettings, ...hooksConfig };
          await writeFile(hooksPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
          console.error(chalk.green('✓'), 'Claude Code hooks configured at .claude/settings.json');
        } catch (err) {
          console.error(chalk.red('✗'), `Hooks failed: ${(err as Error).message}`);
        }
      }
    }

    // ── 5. Summary ──
    if (updated.length > 0) {
      console.error(
        chalk.green('✓'),
        `${dryRun ? 'Would sync' : 'Synced'} ${String(updated.length)} agent config${updated.length > 1 ? 's' : ''}:`,
        chalk.cyan(updated.join(', ')),
      );
    }
    if (skipped.length > 0) {
      console.error(chalk.dim(`  Skipped (not detected): ${skipped.join(', ')}`));
    }
  });
