import * as fs from 'fs';
import * as path from 'path';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Smart injection into AI agent config files
 *
 * Injects a Contox section between <!-- contox:start --> and <!-- contox:end -->
 * markers. User content outside the markers is NEVER touched.
 *
 * Two modes:
 *  1. Basic (no brain data)  → generic MCP + file-based instructions
 *  2. Smart (with brain)     → project brief + MCP protocol + conventions
 *
 * Supported AI tools:
 *   - Cursor       → .cursorrules
 *   - Copilot      → .github/copilot-instructions.md
 *   - Windsurf     → .windsurfrules
 *   - Cline        → .clinerules
 *   - Claude Code  → CLAUDE.md (handled separately by MCP server)
 * ═══════════════════════════════════════════════════════════════════════════════ */

const MARKER_START = '<!-- contox:start -->';
const MARKER_END = '<!-- contox:end -->';

interface RuleTarget {
  name: string;
  relPath: string;
  /** Also inject if this directory exists (even if the file doesn't) */
  dirHint?: string;
  /** Whether this agent supports MCP tools */
  hasMcp: boolean;
}

const TARGETS: RuleTarget[] = [
  { name: 'Cursor', relPath: '.cursorrules', dirHint: '.cursor', hasMcp: true },
  { name: 'Copilot', relPath: path.join('.github', 'copilot-instructions.md'), dirHint: '.github', hasMcp: true },
  { name: 'Windsurf', relPath: '.windsurfrules', hasMcp: true },
  { name: 'Cline', relPath: '.clinerules', hasMcp: true },
];

/**
 * Build the Contox section content.
 * When brain summary is provided, injects a project brief + MCP protocol.
 * When not, falls back to file-based instructions.
 */
function buildSection(hasMcp: boolean, brainSummary?: string): string {
  const lines: string[] = [];

  lines.push('# Contox — Auto-generated Project Context');
  lines.push('');
  lines.push('> This section is auto-managed by Contox. Do not edit between the markers.');
  lines.push('> Your own content outside the markers is preserved.');
  lines.push('');

  if (hasMcp) {
    // ── MCP-capable agents: protocol + brief ──
    lines.push('## Memory Protocol');
    lines.push('');
    lines.push('### Session Start');
    lines.push('- Call `contox_get_memory` to load project context from previous sessions');
    lines.push('');
    lines.push('### During Session');
    lines.push('- **BEFORE modifying any file**: call `contox_context_pack` with a brief task description');
    lines.push('  to get architecture decisions, conventions, and known issues relevant to your work');
    lines.push('- Use `contox_search "topic"` to find specific memory items');
    lines.push('- Use `contox_ask "question"` for natural-language questions about the project');
    lines.push('- Use all Contox tools freely to read/write data');
    lines.push('');
    lines.push('### Saving — USER-INITIATED ONLY');
    lines.push('- **NEVER** call `contox_save_session` automatically or proactively');
    lines.push('- Only save when the user explicitly asks (e.g. "save", "save session", "contox save")');
    lines.push('- The user may be working on multiple tasks in parallel — auto-saving could mix contexts');
    lines.push('');
  } else {
    // ── Non-MCP agents: file-based instructions ──
    lines.push('## MANDATORY: Read memory at session start');
    lines.push('- Read `.contox/memory.md` BEFORE starting any work');
    lines.push('- This is your primary source of truth about this project');
    lines.push('- Do NOT ask questions that are already answered in the memory');
    lines.push('');
    lines.push('## Active file context');
    lines.push('- `.contox/context.md` contains focused context relevant to your current file');
    lines.push('- This file updates automatically as you navigate the codebase');
    lines.push('');
    lines.push('## Save your work at session end');
    lines.push('- Run: `contox save "Brief summary of what you did"`');
    lines.push('- Categories: architecture, conventions, implementation, decisions, bugs, todo');
    lines.push('');
  }

  // ── Project brief from brain summary ──
  if (brainSummary) {
    lines.push(brainSummary);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Merge the Contox section into existing file content.
 * If markers already exist → replace between them.
 * If no markers → append at the end.
 * If file is empty → return just the section.
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
 * Inject Contox instructions into all detected AI rule files.
 * When brainSummary is provided, each file gets the project brief + MCP protocol.
 * Returns the list of AI tool names that were injected.
 */
export function injectAllRuleFiles(rootPath: string, brainSummary?: string): string[] {
  const injected: string[] = [];

  for (const target of TARGETS) {
    const filePath = path.join(rootPath, target.relPath);
    const fileExists = fs.existsSync(filePath);
    const dirExists = target.dirHint
      ? fs.existsSync(path.join(rootPath, target.dirHint))
      : false;

    // Only inject if file exists OR its hint directory exists
    if (!fileExists && !dirExists) {
      continue;
    }

    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      const section = buildSection(target.hasMcp, brainSummary);
      const existing = fileExists ? fs.readFileSync(filePath, 'utf-8') : '';
      const merged = mergeSection(existing, section);
      fs.writeFileSync(filePath, merged, 'utf-8');
      injected.push(target.name);
    } catch {
      // Non-critical — skip this target
    }
  }

  return injected;
}
