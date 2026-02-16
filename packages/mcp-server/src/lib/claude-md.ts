/* ═══════════════════════════════════════════════════════════════════════════════
 * CLAUDE.md Generator — Auto-generates & maintains the Contox section
 *
 * Uses markers to safely update only the Contox-managed section:
 *   <!-- contox:start --> ... <!-- contox:end -->
 *
 * User content outside the markers is NEVER touched.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContoxApiClient } from '../api/client.js';

const MARKER_START = '<!-- contox:start -->';
const MARKER_END = '<!-- contox:end -->';

/**
 * Generate & write the Contox section in CLAUDE.md.
 * - If the file doesn't exist → create it with just the Contox section
 * - If it exists without markers → append the section at the end
 * - If it exists with markers → replace only the section between markers
 *
 * Returns true on success, false on non-critical failure.
 */
export async function updateClaudeMd(
  projectDir: string,
  client: ContoxApiClient,
  brainDoc?: string,
  brainSummary?: string,
): Promise<boolean> {
  try {
    const section = await buildContoxSection(client, brainDoc, brainSummary);
    const filePath = join(projectDir, 'CLAUDE.md');

    let existing = '';
    try {
      existing = await readFile(filePath, 'utf-8');
    } catch {
      // File doesn't exist — will create it
    }

    const newContent = mergeSection(existing, section);
    await writeFile(filePath, newContent, 'utf-8');
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[contox] CLAUDE.md update failed: ${msg}`);
    return false;
  }
}

/**
 * Merge the Contox section into existing CLAUDE.md content.
 * Preserves all user content outside the markers.
 */
function mergeSection(existing: string, section: string): string {
  const wrapped = `${MARKER_START}\n${section}\n${MARKER_END}`;

  // No existing file → just the section
  if (!existing.trim()) {
    return wrapped + '\n';
  }

  const startIdx = existing.indexOf(MARKER_START);
  const endIdx = existing.indexOf(MARKER_END);

  // Markers exist → replace between them
  if (startIdx !== -1 && endIdx !== -1) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + MARKER_END.length);
    return before + wrapped + after;
  }

  // No markers → append at the end with a blank line separator
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  return existing + separator + wrapped + '\n';
}

/**
 * Build the Contox-managed section content from brain data.
 * Extracts key project info: stack, conventions, and auto-save protocol.
 */
async function buildContoxSection(client: ContoxApiClient, brainDoc?: string, brainSummary?: string): Promise<string> {
  const lines: string[] = [];

  lines.push('# Contox — Auto-generated Project Context');
  lines.push('');
  lines.push('> This section is auto-managed by Contox. Do not edit between the markers.');
  lines.push('> Your own content outside the markers is preserved.');
  lines.push('');

  // ── Memory protocol (always included) ──
  lines.push('## Memory Protocol');
  lines.push('');
  lines.push('### Session Start');
  lines.push('- Call `contox_get_memory` to load project context from previous sessions');
  lines.push('');
  lines.push('### During Session');
  lines.push('- Use `contox_search "topic"` to find specific memory items about what you\'re working on');
  lines.push('- Use `contox_context_pack` with a task description for focused, task-relevant context');
  lines.push('- Use all Contox tools freely to read/write data (create contexts, update, search, scan, etc.)');
  lines.push('- This pushes information to the Contox platform in real-time');
  lines.push('');
  lines.push('### Saving — USER-INITIATED ONLY');
  lines.push('- **NEVER** call `contox_save_session` automatically or proactively');
  lines.push('- Only save when the user explicitly asks (e.g. "save", "save session", "contox save")');
  lines.push('- The user may be working on multiple tasks in parallel — auto-saving could mix contexts');
  lines.push('');

  // ── Project context from brain ──
  if (brainSummary) {
    // V2 smart summary — purpose-built for CLAUDE.md (project brief + conventions)
    lines.push(brainSummary);
    lines.push('');
  } else if (brainDoc) {
    // V2 brain document available — embed it directly (truncated)
    lines.push(extractSummary(brainDoc, 2000));
    lines.push('');
  } else {
    // V1 fallback — fetch individual contexts
    try {
      const contexts = await client.listContexts();

      // Extract stack/architecture info
      const stackCtx = contexts.find((c) => c.schemaKey === 'root/stack');
      if (stackCtx) {
        const content = await safeGetContent(client, stackCtx);
        if (content) {
          lines.push('## Project Stack');
          lines.push('');
          lines.push(extractSummary(content, 500));
          lines.push('');
        }
      }

      // Extract conventions
      const convCtx = contexts.find((c) => c.schemaKey === 'root/conventions');
      if (convCtx) {
        const content = await safeGetContent(client, convCtx);
        if (content) {
          lines.push('## Conventions');
          lines.push('');
          lines.push(extractSummary(content, 500));
          lines.push('');
        }
      }

      // Extract current focus from cortex
      const cortexCtx = contexts.find((c) => c.schemaKey === 'root/cortex');
      if (cortexCtx) {
        const content = await safeGetContent(client, cortexCtx);
        if (content) {
          lines.push('## Current Focus');
          lines.push('');
          lines.push(extractSummary(content, 300));
          lines.push('');
        }
      }
    } catch {
      // Brain data is optional — protocol alone is enough
      lines.push('## Project Context');
      lines.push('');
      lines.push('_Run `contox_get_memory` at session start to load full project context._');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Extract a concise summary from a markdown content block.
 * Takes the first N characters, cutting at a line boundary.
 */
function extractSummary(content: string, maxChars: number): string {
  const trimmed = content.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }

  // Cut at the last newline before maxChars
  const cut = trimmed.slice(0, maxChars);
  const lastNewline = cut.lastIndexOf('\n');
  if (lastNewline > maxChars * 0.5) {
    return cut.slice(0, lastNewline);
  }
  return cut + '...';
}

/** Safely get context content */
async function safeGetContent(
  client: ContoxApiClient,
  ctx: { id: string; content?: string | null },
): Promise<string> {
  if (ctx.content != null && ctx.content.length > 0) {
    return ctx.content;
  }
  try {
    const full = await client.getContext(ctx.id);
    return full.content ?? '';
  } catch {
    return '';
  }
}
