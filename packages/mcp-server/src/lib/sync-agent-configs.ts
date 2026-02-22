/* ═══════════════════════════════════════════════════════════════════════════════
 * Sync Agent Configs — Update ALL AI agent config files after a session save
 *
 * Extends the CLAUDE.md-only approach to cover ALL detected AI tools:
 *   - CLAUDE.md          (Claude Code — handled by claude-md.ts)
 *   - .cursorrules       (Cursor)
 *   - .windsurfrules     (Windsurf)
 *   - .clinerules        (Cline)
 *   - .github/copilot-instructions.md (Copilot)
 *
 * Uses the same marker-based injection as inject-rules.ts but runs inside
 * the MCP server (Node.js) instead of VS Code, so it works universally.
 *
 * Called fire-and-forget after contox_save_session.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ContoxApiClient } from '../api/client.js';
import type { V2Client } from '../api/v2-client.js';
import { updateClaudeMd } from './claude-md.js';

const MARKER_START = '<!-- contox:start -->';
const MARKER_END = '<!-- contox:end -->';

interface AgentTarget {
  name: string;
  relPath: string;
  /** Create if this directory exists (even if file doesn't) */
  dirHint?: string;
  hasMcp: boolean;
}

const TARGETS: AgentTarget[] = [
  { name: 'Cursor', relPath: '.cursorrules', dirHint: '.cursor', hasMcp: true },
  { name: 'Copilot', relPath: '.github/copilot-instructions.md', dirHint: '.github', hasMcp: true },
  { name: 'Windsurf', relPath: '.windsurfrules', hasMcp: true },
  { name: 'Cline', relPath: '.clinerules', hasMcp: true },
];

/**
 * Build the Contox section for a given agent type.
 */
function buildSection(hasMcp: boolean, brainSummary?: string): string {
  const lines: string[] = [];

  lines.push('# Contox — Auto-generated Project Context');
  lines.push('');
  lines.push('> This section is auto-managed by Contox. Do not edit between the markers.');
  lines.push('> Your own content outside the markers is preserved.');
  lines.push('');

  if (hasMcp) {
    lines.push('## Memory Protocol');
    lines.push('');
    lines.push('### Session Start');
    lines.push('- Call `contox_get_memory` to load project context from previous sessions');
    lines.push('');
    lines.push('### During Session');
    lines.push('- **BEFORE modifying any file**: call `contox_context_pack` with a brief task description');
    lines.push('  to get architecture decisions, conventions, and known issues relevant to your work');
    lines.push('- For browsing by category (security, architecture, bugs, etc.): use `contox_list_findings`');
    lines.push('- For free-text semantic search: use `contox_search "topic"` (NOT for category browsing)');
    lines.push('- For natural-language questions about the project: use `contox_ask "question"`');
    lines.push('- Use all Contox tools freely to read/write data');
    lines.push('');
    lines.push('### Saving — USER-INITIATED ONLY');
    lines.push('- **NEVER** call `contox_save_session` automatically or proactively');
    lines.push('- Only save when the user explicitly asks (e.g. "save", "save session", "contox save")');
    lines.push('- The user may be working on multiple tasks in parallel — auto-saving could mix contexts');
    lines.push('');
  } else {
    lines.push('## MANDATORY: Read memory at session start');
    lines.push('- Read `.contox/memory.md` BEFORE starting any work');
    lines.push('- This is your primary source of truth about this project');
    lines.push('');
    lines.push('## Save your work at session end');
    lines.push('- Run: `contox save "Brief summary of what you did"`');
    lines.push('');
  }

  if (brainSummary) {
    lines.push(brainSummary);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Merge the Contox section into existing file content using markers.
 */
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

/**
 * Update a single agent config file.
 * Returns the agent name on success, null on skip/failure.
 */
async function updateAgentFile(
  rootPath: string,
  target: AgentTarget,
  brainSummary?: string,
): Promise<string | null> {
  const filePath = join(rootPath, target.relPath);
  const fileExists = existsSync(filePath);
  const dirExists = target.dirHint
    ? existsSync(join(rootPath, target.dirHint))
    : false;

  // Only inject if file exists OR its hint directory exists
  if (!fileExists && !dirExists) {
    return null;
  }

  try {
    const parentDir = dirname(filePath);
    if (!existsSync(parentDir)) {
      await mkdir(parentDir, { recursive: true });
    }

    let existing = '';
    try {
      existing = await readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist — will create it
    }

    const section = buildSection(target.hasMcp, brainSummary);
    const merged = mergeSection(existing, section);
    await writeFile(filePath, merged, 'utf-8');
    return target.name;
  } catch {
    return null;
  }
}

/**
 * Sync ALL agent config files after a session save.
 * Fetches brain summary, then updates CLAUDE.md + all other agent configs.
 *
 * This is called fire-and-forget from contox_save_session.
 */
export async function syncAllAgentConfigs(
  projectDir: string,
  client: ContoxApiClient,
  v2: V2Client,
  brainDoc?: string,
  brainSummary?: string,
): Promise<{ updated: string[]; errors: string[] }> {
  const updated: string[] = [];
  const errors: string[] = [];

  // 1. Fetch brain if not provided
  let summary = brainSummary;
  let document = brainDoc;
  if (!summary) {
    try {
      const brain = await v2.getBrain();
      summary = brain.summary;
      document = brain.document;
    } catch {
      // Proceed without brain data — still inject protocol instructions
    }
  }

  // 2. Update CLAUDE.md (existing behavior)
  try {
    const ok = await updateClaudeMd(projectDir, client, document, summary);
    if (ok) { updated.push('Claude Code'); }
  } catch {
    errors.push('Claude Code');
  }

  // 3. Update all other agent config files in parallel
  const results = await Promise.allSettled(
    TARGETS.map((target) => updateAgentFile(projectDir, target, summary)),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      updated.push(result.value);
    }
  }

  if (updated.length > 0) {
    console.error(`[contox] Synced ${String(updated.length)} agent configs: ${updated.join(', ')}`);
  }

  return { updated, errors };
}
