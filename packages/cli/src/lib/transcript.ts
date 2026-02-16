/* ═══════════════════════════════════════════════════════════════════════════════
 * Transcript Reader — Reads Claude Code JSONL transcripts for auto-save
 *
 * Discovers the active transcript file, reads the delta since the last save
 * (via byte offset cursor), parses JSONL lines, and extracts structured facts
 * (files modified, commands run, user requests).
 *
 * Used by `contox save --auto` and PreCompact/SessionEnd hooks.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { createReadStream, existsSync, readFileSync, writeFileSync, mkdirSync, statSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { createInterface } from 'node:readline';

// ── Types ────────────────────────────────────────────────────────────────────

interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'image';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface TranscriptLine {
  type: 'user' | 'assistant' | 'queue-operation' | 'file-history-snapshot' | string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  isSidechain?: boolean;
  message?: {
    role: 'user' | 'assistant';
    content: ContentBlock[];
  };
}

interface CommandFact {
  command: string;
  description?: string;
}

export interface SessionFacts {
  filesModified: Set<string>;
  filesRead: Set<string>;
  userRequests: string[];
  commandsRun: CommandFact[];
  contoxSaveCalled: boolean;
  timeRange: { start: string; end: string } | null;
}

export interface SaveCursor {
  sessionId: string;
  byteOffset: number;
  savedAt: string;
}

export interface SessionInput {
  summary: string;
  changes: Array<{ category: string; title: string; content: string }>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_LINES = 10_000;
const MAX_USER_REQUEST_LEN = 200;
const MAX_COMMAND_LEN = 300;
const CURSOR_DIR = '.contox';
const CURSOR_FILE = 'save-cursor.json';

// ── Discovery ────────────────────────────────────────────────────────────────

/**
 * Derive the Claude Code project hash from a directory path.
 * Algorithm: replace all non-alphanumeric chars with '-'.
 * Example: "d:\Contox" → "d--Contox"
 */
export function getProjectHash(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Get the Claude Code projects directory.
 */
export function getClaudeProjectsDir(): string {
  return join(homedir(), '.claude', 'projects');
}

/**
 * Find the most recently modified JSONL transcript for a project hash.
 * Looks in ~/.claude/projects/<hash>/ for .jsonl files (not in subagents/).
 */
export function findActiveTranscript(projectHash: string): string | null {
  const dir = join(getClaudeProjectsDir(), projectHash);

  if (!existsSync(dir)) {
    return null;
  }

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }

  // Only consider .jsonl files at root level (not subagents/)
  const jsonlFiles = entries
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const fullPath = join(dir, f);
      try {
        const st = statSync(fullPath);
        return { path: fullPath, mtime: st.mtimeMs };
      } catch {
        return null;
      }
    })
    .filter((f): f is { path: string; mtime: number } => f !== null);

  if (jsonlFiles.length === 0) {
    return null;
  }

  // Sort by most recently modified
  jsonlFiles.sort((a, b) => b.mtime - a.mtime);
  return jsonlFiles[0]!.path;
}

// ── Cursor Management ────────────────────────────────────────────────────────

export function readCursor(projectDir: string): SaveCursor | null {
  const filePath = join(projectDir, CURSOR_DIR, CURSOR_FILE);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as SaveCursor;
  } catch {
    return null;
  }
}

export function writeCursor(projectDir: string, cursor: SaveCursor): void {
  const dir = join(projectDir, CURSOR_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(join(dir, CURSOR_FILE), JSON.stringify(cursor, null, 2) + '\n', 'utf-8');
}

// ── Delta Reading ────────────────────────────────────────────────────────────

/**
 * Read JSONL lines from a transcript file starting at a byte offset.
 * Uses createReadStream with start option for efficient seeking.
 * Returns parsed lines and the new byte offset.
 */
export async function readTranscriptDelta(
  filePath: string,
  fromOffset: number,
): Promise<{ lines: TranscriptLine[]; newOffset: number }> {
  const fileSize = statSync(filePath).size;

  if (fromOffset >= fileSize) {
    return { lines: [], newOffset: fromOffset };
  }

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath, {
      start: fromOffset,
      encoding: 'utf-8',
    });

    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    const lines: TranscriptLine[] = [];
    let lineCount = 0;
    let isFirstLine = fromOffset > 0; // First line may be partial
    let bytesRead = 0;

    rl.on('line', (raw: string) => {
      bytesRead += Buffer.byteLength(raw, 'utf-8') + 1; // +1 for newline

      // Skip first partial line when seeking mid-file
      if (isFirstLine) {
        isFirstLine = false;
        return;
      }

      // Enforce line limit
      if (lineCount >= MAX_LINES) {
        rl.close();
        stream.destroy();
        return;
      }

      lineCount++;

      try {
        const parsed = JSON.parse(raw) as TranscriptLine;

        // Only keep conversation messages (skip queue-operation, file-history-snapshot, etc.)
        if (parsed.type !== 'user' && parsed.type !== 'assistant') {
          return;
        }

        // Skip sidechain messages (alternate branches)
        if (parsed.isSidechain) {
          return;
        }

        lines.push(parsed);
      } catch {
        // Skip malformed lines
      }
    });

    rl.on('close', () => {
      resolve({ lines, newOffset: fromOffset + bytesRead });
    });

    rl.on('error', reject);
    stream.on('error', reject);
  });
}

// ── Fact Extraction ──────────────────────────────────────────────────────────

/**
 * Extract structured facts from parsed transcript lines.
 */
export function extractFacts(lines: TranscriptLine[]): SessionFacts {
  const facts: SessionFacts = {
    filesModified: new Set(),
    filesRead: new Set(),
    userRequests: [],
    commandsRun: [],
    contoxSaveCalled: false,
    timeRange: null,
  };

  const seenRequests = new Set<string>();

  for (const line of lines) {
    // Track time range
    if (line.timestamp) {
      if (!facts.timeRange) {
        facts.timeRange = { start: line.timestamp, end: line.timestamp };
      } else {
        facts.timeRange.end = line.timestamp;
      }
    }

    if (!line.message?.content) {
      continue;
    }

    for (const block of line.message.content) {
      // ── User text messages ──
      if (block.type === 'text' && line.type === 'user' && block.text) {
        // Skip tool results that appear as user messages
        if (line.message.content.some((b) => b.type === 'tool_result')) {
          continue;
        }

        const text = block.text.trim();
        if (text.length > 0 && !seenRequests.has(text)) {
          seenRequests.add(text);
          const truncated = text.length > MAX_USER_REQUEST_LEN
            ? text.slice(0, MAX_USER_REQUEST_LEN) + '...'
            : text;
          facts.userRequests.push(truncated);
        }
      }

      // ── Tool use blocks ──
      if (block.type === 'tool_use' && block.name && block.input) {
        const toolName = block.name;
        const input = block.input;

        // Files modified (Edit/Write)
        if ((toolName === 'Edit' || toolName === 'Write') && typeof input['file_path'] === 'string') {
          facts.filesModified.add(input['file_path'] as string);
        }

        // Files read
        if (toolName === 'Read' && typeof input['file_path'] === 'string') {
          facts.filesRead.add(input['file_path'] as string);
        }

        // Bash commands
        if (toolName === 'Bash' && typeof input['command'] === 'string') {
          const cmd = (input['command'] as string).slice(0, MAX_COMMAND_LEN);
          const desc = typeof input['description'] === 'string'
            ? (input['description'] as string).slice(0, 100)
            : undefined;
          facts.commandsRun.push({ command: cmd, description: desc });
        }

        // Detect contox_save_session MCP call
        if (toolName === 'mcp__contox__contox_save_session') {
          facts.contoxSaveCalled = true;
        }
      }
    }
  }

  return facts;
}

// ── Session Input Generation ─────────────────────────────────────────────────

/**
 * Convert extracted facts into a SessionInput payload for the save API.
 */
export function factsToSessionInput(facts: SessionFacts): SessionInput {
  const fileCount = facts.filesModified.size;
  const cmdCount = facts.commandsRun.length;
  const reqCount = facts.userRequests.length;

  // Build summary
  const parts: string[] = [];
  if (fileCount > 0) { parts.push(`modified ${String(fileCount)} files`); }
  if (cmdCount > 0) { parts.push(`ran ${String(cmdCount)} commands`); }
  if (reqCount > 0) {
    const firstReq = facts.userRequests[0]!.slice(0, 80);
    parts.push(`user: "${firstReq}"`);
  }

  const summary = `[auto-save] ${parts.join(', ')}`;

  const changes: Array<{ category: string; title: string; content: string }> = [];

  // Files modified
  if (fileCount > 0) {
    const fileList = [...facts.filesModified]
      .map((f) => `- ${f}`)
      .join('\n');
    changes.push({
      category: 'implementation',
      title: `Files modified (${String(fileCount)})`,
      content: fileList,
    });
  }

  // Commands run (deduplicated, max 20)
  if (cmdCount > 0) {
    const uniqueCmds = new Map<string, CommandFact>();
    for (const cmd of facts.commandsRun) {
      if (!uniqueCmds.has(cmd.command)) {
        uniqueCmds.set(cmd.command, cmd);
      }
    }

    const cmdList = [...uniqueCmds.values()]
      .slice(0, 20)
      .map((c) => {
        const desc = c.description ? ` — ${c.description}` : '';
        return `- \`${sanitize(c.command)}\`${desc}`;
      })
      .join('\n');

    changes.push({
      category: 'implementation',
      title: `Commands executed (${String(uniqueCmds.size)})`,
      content: cmdList,
    });
  }

  // User requests (max 10)
  if (reqCount > 0) {
    const reqList = facts.userRequests
      .slice(0, 10)
      .map((r) => `- ${sanitize(r)}`)
      .join('\n');

    changes.push({
      category: 'implementation',
      title: `User requests (${String(Math.min(reqCount, 10))})`,
      content: reqList,
    });
  }

  return { summary, changes };
}

// ── Sanitization ─────────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS = [
  /Bearer\s+\S{20,}/gi,
  /(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /ghp_[a-zA-Z0-9]{36,}/g,
];

function sanitize(text: string): string {
  let result = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}
