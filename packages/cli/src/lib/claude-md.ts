/* ═══════════════════════════════════════════════════════════════════════════════
 * CLAUDE.md Generator (CLI) — Auto-generates & maintains the Contox section
 *
 * Uses markers to safely update only the Contox-managed section:
 *   <!-- contox:start --> ... <!-- contox:end -->
 *
 * User content outside the markers is NEVER touched.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import type { ContextItem } from './api.js';

const MARKER_START = '<!-- contox:start -->';
const MARKER_END = '<!-- contox:end -->';

interface ApiClient {
  get: (path: string) => Promise<Response>;
}

/**
 * Generate & write the Contox section in CLAUDE.md.
 * - If the file doesn't exist → create with just our section
 * - If it exists without markers → append the section
 * - If it exists with markers → replace only between markers
 */
export async function updateClaudeMd(
  projectDir: string,
  api: ApiClient,
  teamId: string,
  projectId: string,
  brainDoc?: string,
): Promise<boolean> {
  try {
    const section = await buildContoxSection(api, teamId, projectId, brainDoc);
    const filePath = join(projectDir, 'CLAUDE.md');

    let existing = '';
    try {
      existing = await readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist — will create it
    }

    const newContent = mergeSection(existing, section);
    await writeFile(filePath, newContent, 'utf-8');
    console.log(chalk.green('✓'), 'Updated', chalk.dim('CLAUDE.md'));
    return true;
  } catch (err) {
    console.log(chalk.yellow('⚠'), 'CLAUDE.md update failed:', (err as Error).message);
    return false;
  }
}

/**
 * Merge the Contox section into existing content.
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
 * Build the Contox section content from API data.
 */
async function buildContoxSection(
  api: ApiClient,
  teamId: string,
  projectId: string,
  brainDoc?: string,
): Promise<string> {
  const lines: string[] = [];

  lines.push('# Contox — Auto-generated Project Context');
  lines.push('');
  lines.push('> This section is auto-managed by Contox. Do not edit between the markers.');
  lines.push('> Your own content outside the markers is preserved.');
  lines.push('');

  // Auto-save protocol
  lines.push('## Auto-Save Protocol (MANDATORY)');
  lines.push('');
  lines.push('### Session Start');
  lines.push('- Call `contox_get_memory` to load project context from previous sessions');
  lines.push('');
  lines.push('### Before Context Compaction (PRE-COMPACT SAVE)');
  lines.push('- When you receive a system message about compaction, or notice the conversation is very long, IMMEDIATELY call `contox_save_session` with ALL work done so far');
  lines.push('- Tag the summary with `[pre-compact]` prefix so it\'s identifiable');
  lines.push('- Be exhaustive — include every file changed, every decision made, every bug found');
  lines.push('');
  lines.push('### After Context Compaction (POST-COMPACT VERIFY)');
  lines.push('- Right after compaction, call `contox_get_memory` to reload what was saved');
  lines.push('- Compare what you remember vs what\'s in memory — save any gaps with `[post-compact-patch]` tag');
  lines.push('');
  lines.push('### Session End');
  lines.push('- Always call `contox_save_session` before the session ends');
  lines.push('- Include: architecture changes, implementations, decisions, bugs fixed, and todos');
  lines.push('');

  // ── Project context ──
  if (brainDoc) {
    // V2 brain document available — embed it directly (truncated)
    lines.push(extractSummary(brainDoc, 2000));
    lines.push('');
  } else {
    // V1 fallback — fetch individual contexts from API
    try {
      const res = await api.get(`/api/contexts?teamId=${teamId}&projectId=${projectId}`);
      if (!res.ok) {
        throw new Error(`API ${String(res.status)}`);
      }

      const contexts = (await res.json()) as (ContextItem & Record<string, unknown>)[];

      const schemaKeysToFetch: { key: string; heading: string; maxChars: number }[] = [
        { key: 'root/stack', heading: '## Project Stack', maxChars: 500 },
        { key: 'root/conventions', heading: '## Conventions', maxChars: 500 },
        { key: 'root/cortex', heading: '## Current Focus', maxChars: 300 },
      ];

      for (const { key, heading, maxChars } of schemaKeysToFetch) {
        const ctx = contexts.find((c) => c['schemaKey'] === key);
        if (!ctx) { continue; }

        // Fetch full content for this context
        const contentRes = await api.get(`/api/contexts/${ctx.id}`);
        if (!contentRes.ok) { continue; }

        const full = (await contentRes.json()) as { content?: string | null };
        if (!full.content?.trim()) { continue; }

        lines.push(heading);
        lines.push('');
        lines.push(extractSummary(full.content, maxChars));
        lines.push('');
      }
    } catch {
      lines.push('## Project Context');
      lines.push('');
      lines.push('_Run `contox_get_memory` at session start to load full project context._');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function extractSummary(content: string, maxChars: number): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  const cut = trimmed.slice(0, maxChars);
  const lastNewline = cut.lastIndexOf('\n');
  if (lastNewline > maxChars * 0.5) {
    return cut.slice(0, lastNewline);
  }
  return cut + '...';
}
