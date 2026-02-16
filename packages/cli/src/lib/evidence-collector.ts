/* eslint-disable no-console */
/* ═══════════════════════════════════════════════════════════════════════════════
 * Evidence Collector — Local evidence gathering for V2 pipeline
 *
 * Collects from a developer session:
 * - File changes (git status + diff)
 * - Commit messages (git log)
 * - AI transcripts (Claude Code JSONL)
 *
 * Output: structured JSON for V2 ingest API (mcp_save event format).
 *
 * Used by: `contox collect` CLI command, VS Code extension (future).
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  findActiveTranscript,
  getProjectHash,
  readTranscriptDelta,
  readCursor,
  writeCursor,
  extractFacts,
  type SessionFacts,
} from './transcript.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type EvidenceType = 'file_change' | 'transcript' | 'commit_message';

export interface Evidence {
  evidenceId: string;
  type: EvidenceType;
  timestamp: string;
  path?: string;
  diff?: string;
  content?: string;
  metadata?: {
    linesAdded?: number;
    linesRemoved?: number;
    author?: string;
    commitHash?: string;
  };
}

export interface SessionMetadata {
  sessionId: string;
  startTime: string;
  endTime: string;
  branch: string;
  repository: string;
  totalFiles: number;
  totalEvidences: number;
}

export interface CollectedEvidences {
  evidences: Evidence[];
  sessionMetadata: SessionMetadata;
}

export interface CollectorConfig {
  gitDiffContext: number;
  ignorePatterns: RegExp[];
  includeCommits: boolean;
  includeTranscripts: boolean;
  maxDiffSize: number;
  timeRange?: { start: Date; end: Date };
}

// ── Default Config ───────────────────────────────────────────────────────────

const DEFAULT_IGNORE_PATTERNS: RegExp[] = [
  /node_modules\//,
  /\.next\//,
  /dist\//,
  /build\//,
  /\.vercel\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /bun\.lockb$/,
  /\.env$/,
  /\.env\./,
  /\.log$/,
  /\.cache\//,
  /\.map$/,
  /\.min\.js$/,
  /\.min\.css$/,
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /\.vscode\//,
  /\.idea\//,
  /\.swp$/,
  /\.vsix$/,
];

export const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  gitDiffContext: 5,
  ignorePatterns: DEFAULT_IGNORE_PATTERNS,
  includeCommits: true,
  includeTranscripts: true,
  maxDiffSize: 10_000,
};

// ── Git Helpers ──────────────────────────────────────────────────────────────

function git(cmd: string, cwd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch {
    return '';
  }
}

function isGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch(cwd: string): string {
  return git('branch --show-current', cwd) || 'unknown';
}

function getRepoName(cwd: string): string {
  const remoteUrl = git('config --get remote.origin.url', cwd);
  const match = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] ?? 'unknown';
}

function getModifiedFiles(cwd: string): string[] {
  const output = git('status --short', cwd);
  if (!output) { return []; }

  return output
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.substring(3).trim())
    .filter((f) => f.length > 0);
}

function getDiff(cwd: string, filePath: string, context: number): string {
  // Try unstaged + staged diff first
  let diff = git(`diff -U${String(context)} HEAD -- "${filePath}"`, cwd);
  if (diff) { return diff; }

  // Try staged only
  diff = git(`diff -U${String(context)} --cached -- "${filePath}"`, cwd);
  if (diff) { return diff; }

  return `+++ ${filePath}\n(New file)`;
}

function countDiffStats(diff: string): { added: number; removed: number } {
  const lines = diff.split('\n');
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) { added++; }
    else if (line.startsWith('-') && !line.startsWith('---')) { removed++; }
  }
  return { added, removed };
}

interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

function getCommitMessages(cwd: string, since?: Date): CommitInfo[] {
  let cmd = 'log --pretty=format:"%H|%an|%ai|%s"';
  if (since) {
    cmd += ` --since="${since.toISOString()}"`;
  }

  const output = git(cmd, cwd);
  if (!output) { return []; }

  return output
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const parts = line.split('|');
      return {
        hash: parts[0] ?? '',
        author: parts[1] ?? '',
        date: parts[2] ?? '',
        message: parts.slice(3).join('|'),
      };
    });
}

// ── Main Collector ───────────────────────────────────────────────────────────

export class EvidenceCollector {
  private config: CollectorConfig;

  constructor(
    private repoPath: string,
    config?: Partial<CollectorConfig>,
  ) {
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
  }

  /**
   * Collect all evidences from the current session.
   */
  async collect(): Promise<CollectedEvidences> {
    const startTime = new Date();

    if (!isGitRepo(this.repoPath)) {
      throw new Error(`Not a Git repository: ${this.repoPath}`);
    }

    // 1. File changes
    const fileEvidences = this.collectFileChanges();

    // 2. Commits
    const commitEvidences = this.collectCommits();

    // 3. Transcripts
    const transcriptEvidences = await this.collectTranscripts();

    // 4. Combine & sort
    const allEvidences = [
      ...fileEvidences,
      ...commitEvidences,
      ...transcriptEvidences,
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const endTime = new Date();

    const sessionMetadata: SessionMetadata = {
      sessionId: `session_${randomUUID().substring(0, 8)}`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      branch: getCurrentBranch(this.repoPath),
      repository: getRepoName(this.repoPath),
      totalFiles: fileEvidences.length,
      totalEvidences: allEvidences.length,
    };

    return { evidences: allEvidences, sessionMetadata };
  }

  // ── File Changes ─────────────────────────────────────────────────────────

  private collectFileChanges(): Evidence[] {
    const files = getModifiedFiles(this.repoPath);
    const evidences: Evidence[] = [];

    for (const filePath of files) {
      if (this.shouldIgnore(filePath)) { continue; }

      const diff = getDiff(this.repoPath, filePath, this.config.gitDiffContext);
      if (!diff || diff.trim().length === 0) { continue; }
      if (diff.length > this.config.maxDiffSize) { continue; }

      const stats = countDiffStats(diff);

      evidences.push({
        evidenceId: `ev_file_${randomUUID().substring(0, 8)}`,
        type: 'file_change',
        timestamp: new Date().toISOString(),
        path: filePath,
        diff,
        metadata: { linesAdded: stats.added, linesRemoved: stats.removed },
      });
    }

    return evidences;
  }

  // ── Commits ──────────────────────────────────────────────────────────────

  private collectCommits(): Evidence[] {
    if (!this.config.includeCommits) { return []; }

    const commits = getCommitMessages(this.repoPath, this.config.timeRange?.start);

    return commits.map((commit) => ({
      evidenceId: `ev_commit_${randomUUID().substring(0, 8)}`,
      type: 'commit_message' as const,
      timestamp: commit.date || new Date().toISOString(),
      content: commit.message,
      metadata: { author: commit.author, commitHash: commit.hash },
    }));
  }

  // ── Transcripts ──────────────────────────────────────────────────────────

  private async collectTranscripts(): Promise<Evidence[]> {
    if (!this.config.includeTranscripts) { return []; }

    const projectHash = getProjectHash(this.repoPath);
    const transcriptPath = findActiveTranscript(projectHash);
    if (!transcriptPath) { return []; }

    // Read from cursor (delta since last collect) or from beginning
    const cursor = readCursor(this.repoPath);
    const fromOffset = cursor?.byteOffset ?? 0;

    const { lines, newOffset } = await readTranscriptDelta(transcriptPath, fromOffset);
    if (lines.length === 0) { return []; }

    const facts = extractFacts(lines);

    // Build transcript text from facts
    const content = this.formatTranscriptFacts(facts);
    if (!content) { return []; }

    // Save cursor for next delta read
    writeCursor(this.repoPath, {
      sessionId: projectHash,
      byteOffset: newOffset,
      savedAt: new Date().toISOString(),
    });

    return [{
      evidenceId: `ev_transcript_${randomUUID().substring(0, 8)}`,
      type: 'transcript',
      timestamp: facts.timeRange?.start ?? new Date().toISOString(),
      content,
    }];
  }

  private formatTranscriptFacts(facts: SessionFacts): string | null {
    const parts: string[] = [];

    if (facts.userRequests.length > 0) {
      parts.push('User requests:');
      for (const req of facts.userRequests.slice(0, 10)) {
        parts.push(`  - ${req}`);
      }
    }

    if (facts.filesModified.size > 0) {
      parts.push('', 'Files modified:');
      for (const f of [...facts.filesModified].slice(0, 30)) {
        parts.push(`  - ${f}`);
      }
    }

    if (facts.commandsRun.length > 0) {
      parts.push('', 'Commands run:');
      for (const cmd of facts.commandsRun.slice(0, 15)) {
        const desc = cmd.description ? ` (${cmd.description})` : '';
        parts.push(`  - ${cmd.command.slice(0, 200)}${desc}`);
      }
    }

    if (facts.timeRange) {
      parts.push('', `Time range: ${facts.timeRange.start} to ${facts.timeRange.end}`);
    }

    return parts.length > 0 ? parts.join('\n') : null;
  }

  // ── Filter ───────────────────────────────────────────────────────────────

  private shouldIgnore(filePath: string): boolean {
    return this.config.ignorePatterns.some((pattern) => pattern.test(filePath));
  }
}

// ── V2 Ingest Bridge ─────────────────────────────────────────────────────────

/**
 * Convert CollectedEvidences into an mcp_save event payload
 * ready for the V2 ingest API.
 */
export function toMcpSaveEvent(collected: CollectedEvidences): {
  type: 'mcp_save';
  summary: string;
  changes: { category: string; title: string; content: string }[];
  headCommitSha?: string;
} {
  const changes: { category: string; title: string; content: string }[] = [];
  let headCommitSha: string | undefined;

  // File changes → implementation changes
  const fileEvidences = collected.evidences.filter((e) => e.type === 'file_change');
  if (fileEvidences.length > 0) {
    for (const ev of fileEvidences.slice(0, 20)) {
      changes.push({
        category: 'implementation',
        title: `Changed ${ev.path ?? 'unknown'}`,
        content: ev.diff?.slice(0, 4000) ?? '(no diff)',
      });
    }
  }

  // Commits → implementation changes
  const commitEvidences = collected.evidences.filter((e) => e.type === 'commit_message');
  if (commitEvidences.length > 0) {
    headCommitSha = commitEvidences[0]?.metadata?.commitHash;

    const commitList = commitEvidences
      .slice(0, 10)
      .map((e) => `- ${e.metadata?.commitHash?.slice(0, 7) ?? '?'}: ${e.content ?? ''}`)
      .join('\n');

    changes.push({
      category: 'implementation',
      title: `Commits (${String(commitEvidences.length)})`,
      content: commitList,
    });
  }

  // Transcripts → architecture/decisions context
  const transcriptEvidences = collected.evidences.filter((e) => e.type === 'transcript');
  if (transcriptEvidences.length > 0) {
    for (const ev of transcriptEvidences) {
      changes.push({
        category: 'architecture',
        title: 'Session transcript',
        content: ev.content?.slice(0, 5000) ?? '',
      });
    }
  }

  // Build summary
  const fileParts = fileEvidences.length > 0 ? `${String(fileEvidences.length)} files changed` : '';
  const commitParts = commitEvidences.length > 0 ? `${String(commitEvidences.length)} commits` : '';
  const parts = [fileParts, commitParts].filter(Boolean).join(', ');
  const summary = `[evidence-collector] ${parts || 'session capture'} on ${collected.sessionMetadata.branch}`;

  return {
    type: 'mcp_save',
    summary,
    changes,
    ...(headCommitSha ? { headCommitSha } : {}),
  };
}
