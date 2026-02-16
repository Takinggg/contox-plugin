/* ═══════════════════════════════════════════════════════════════════════════════
 * Git Digest — Read git history since last save for Claude enrichment
 *
 * Runs locally via execSync (MCP server has filesystem access).
 * Returns structured commit data + WIP evidence.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

import type { ContoxApiClient } from '../api/client.js';

// ── Interfaces ───────────────────────────────────────────────────────────────

export interface GitCommit {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  files: string[];
  numstat: string;
  diffStat: string;
  patch: string | null;
}

export interface WipEvidence {
  staged: string;
  unstaged: string;
  untrackedFiles: string[];
}

export interface GitDigestResult {
  repoRoot: string;
  currentBranch: string;
  headSha: string;
  isDirty: boolean;
  untrackedCount: number;

  baseSha: string | null;
  range: string;
  mode: 'first-parent' | 'all';
  commits: GitCommit[];
  totalUnsaved: number;
  truncated: boolean;

  wip: WipEvidence | null;
}

export interface GitDigestOptions {
  directory?: string;
  limit?: number;
  mode?: 'first-parent' | 'all';
}

// ── Constants ────────────────────────────────────────────────────────────────

const EXEC_TIMEOUT = 10_000;
const EXEC_MAX_BUFFER = 1024 * 1024;
const PATCH_MAX_PER_COMMIT = 2048;
const WIP_MAX_SIZE = 5120;
const SMALL_COMMIT_THRESHOLD = 200; // lines changed
const COMMIT_SEPARATOR = '‹‹‹COMMIT_SEP›››';
const FIELD_SEPARATOR = '‹‹‹FIELD_SEP›››';
const DEFAULT_LIMIT = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function git(args: string, cwd: string): string {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf-8',
      timeout: EXEC_TIMEOUT,
      maxBuffer: EXEC_MAX_BUFFER,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n[...truncated at ${String(max)} chars]`;
}

function countLinesChanged(numstatOutput: string): number {
  let total = 0;
  for (const line of numstatOutput.split('\n')) {
    const parts = line.split('\t');
    const added = parseInt(parts[0] ?? '0', 10);
    const removed = parseInt(parts[1] ?? '0', 10);
    if (!isNaN(added)) { total += added; }
    if (!isNaN(removed)) { total += removed; }
  }
  return total;
}

// ── Main ─────────────────────────────────────────────────────────────────────

/**
 * Resolve the base SHA from the last session entry's sourceRef.
 * Format expected: "git:<sha>" or just a session ID (fallback to null).
 */
async function resolveBaseSha(
  client: ContoxApiClient,
  cwd: string,
): Promise<string | null> {
  try {
    const sessionsCtx = await client.findBySchemaKey('root/sessions');
    if (!sessionsCtx) { return null; }

    const entries = await client.listEntries(sessionsCtx.id, { limit: 1 });
    if (entries.entries.length === 0) { return null; }

    const sourceRef = entries.entries[0]?.sourceRef;
    if (!sourceRef || !sourceRef.startsWith('git:')) { return null; }

    const sha = sourceRef.slice(4);

    // Verify the SHA exists in this repo
    const verified = git(`cat-file -t ${sha}`, cwd);
    if (verified !== 'commit') { return null; }

    return sha;
  } catch {
    return null;
  }
}

/**
 * Parse git log output into GitCommit array.
 */
function parseCommits(raw: string): Array<{ sha: string; shortSha: string; message: string; author: string; date: string }> {
  if (!raw) { return []; }

  const blocks = raw.split(COMMIT_SEPARATOR).filter((b) => b.trim().length > 0);
  const results: Array<{ sha: string; shortSha: string; message: string; author: string; date: string }> = [];

  for (const block of blocks) {
    const fields = block.split(FIELD_SEPARATOR);
    if (fields.length < 5) { continue; }

    results.push({
      sha: (fields[0] ?? '').trim(),
      shortSha: (fields[1] ?? '').trim(),
      author: (fields[2] ?? '').trim(),
      date: (fields[3] ?? '').trim(),
      message: (fields[4] ?? '').trim(),
    });
  }

  return results;
}

/**
 * Get detailed info for a single commit: files, numstat, diffStat, patch.
 */
function getCommitDetail(sha: string, cwd: string): Omit<GitCommit, 'sha' | 'shortSha' | 'message' | 'author' | 'date'> {
  const nameOnly = git(`show ${sha} --name-only --format=`, cwd);
  const files = nameOnly.split('\n').filter((f) => f.trim().length > 0);

  const numstat = git(`show ${sha} --numstat --format=`, cwd);
  const diffStat = git(`show ${sha} --stat --format=`, cwd);
  const linesChanged = countLinesChanged(numstat);

  let patch: string | null = null;
  if (linesChanged > 0 && linesChanged < SMALL_COMMIT_THRESHOLD) {
    const rawPatch = git(`show ${sha} --patch --unified=0 --format=`, cwd);
    if (rawPatch) {
      patch = truncate(rawPatch, PATCH_MAX_PER_COMMIT);
    }
  }

  return { files, numstat, diffStat, patch };
}

/**
 * Collect WIP evidence (staged + unstaged + untracked).
 */
function collectWip(cwd: string, isDirty: boolean, untrackedCount: number): WipEvidence | null {
  if (!isDirty && untrackedCount === 0) { return null; }

  let staged = '';
  let unstaged = '';
  const untrackedFiles: string[] = [];

  if (isDirty) {
    const stagedStat = git('diff --cached --stat', cwd);
    const stagedPatch = git('diff --cached --unified=0', cwd);
    staged = truncate(
      [stagedStat, stagedPatch].filter(Boolean).join('\n\n'),
      WIP_MAX_SIZE,
    );

    const unstagedStat = git('diff --stat', cwd);
    const unstagedPatch = git('diff --unified=0', cwd);
    unstaged = truncate(
      [unstagedStat, unstagedPatch].filter(Boolean).join('\n\n'),
      WIP_MAX_SIZE,
    );
  }

  if (untrackedCount > 0) {
    const raw = git('ls-files --others --exclude-standard', cwd);
    untrackedFiles.push(...raw.split('\n').filter((f) => f.trim().length > 0).slice(0, 50));
  }

  return { staged, unstaged, untrackedFiles };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getGitDigest(
  client: ContoxApiClient,
  opts: GitDigestOptions = {},
): Promise<GitDigestResult> {
  const cwd = opts.directory ? resolve(opts.directory) : process.cwd();
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const mode = opts.mode ?? 'first-parent';

  // Repo identity
  const repoRoot = git('rev-parse --show-toplevel', cwd);
  if (!repoRoot) {
    throw new Error(`Not a git repository: ${cwd}`);
  }

  const currentBranch = git('rev-parse --abbrev-ref HEAD', cwd);
  const headSha = git('rev-parse HEAD', cwd);
  const statusPorcelain = git('status --porcelain', cwd);
  const isDirty = statusPorcelain.length > 0;
  const untrackedRaw = git('ls-files --others --exclude-standard', cwd);
  const untrackedCount = untrackedRaw ? untrackedRaw.split('\n').filter(Boolean).length : 0;

  // Resolve base SHA
  const baseSha = await resolveBaseSha(client, cwd);

  // Build range
  let range: string;
  let logArgs: string;
  const firstParent = mode === 'first-parent' ? ' --first-parent' : '';

  if (baseSha) {
    range = `${baseSha.slice(0, 7)}..HEAD`;
    logArgs = `log${firstParent} ${baseSha}..HEAD`;
  } else {
    range = `HEAD~${String(limit)}..HEAD`;
    logArgs = `log${firstParent} -n ${String(limit)}`;
  }

  // Get commit count first
  const countRaw = git(`${logArgs} --oneline`, cwd);
  const totalUnsaved = countRaw ? countRaw.split('\n').filter(Boolean).length : 0;

  // Get structured log (limited)
  const format = [
    COMMIT_SEPARATOR,
    '%H',
    FIELD_SEPARATOR,
    '%h',
    FIELD_SEPARATOR,
    '%an',
    FIELD_SEPARATOR,
    '%aI',
    FIELD_SEPARATOR,
    '%B',
  ].join('');

  const rawLog = git(`${logArgs} -n ${String(limit)} --format=${format}`, cwd);
  const parsedCommits = parseCommits(rawLog);
  const truncated = totalUnsaved > limit;

  // Enrich each commit with detail
  const commits: GitCommit[] = [];
  for (const base of parsedCommits) {
    const detail = getCommitDetail(base.sha, cwd);
    commits.push({ ...base, ...detail });
  }

  // WIP evidence
  const wip = collectWip(cwd, isDirty, untrackedCount);

  return {
    repoRoot,
    currentBranch,
    headSha,
    isDirty,
    untrackedCount,
    baseSha,
    range,
    mode,
    commits,
    totalUnsaved,
    truncated,
    wip,
  };
}

/**
 * Format a GitDigestResult as a human-readable markdown string for Claude.
 */
export function formatDigest(result: GitDigestResult): string {
  const lines: string[] = [];

  lines.push(`# Git Digest`);
  lines.push('');
  lines.push(`**Branch**: ${result.currentBranch}`);
  lines.push(`**HEAD**: ${result.headSha.slice(0, 7)}`);
  lines.push(`**Range**: ${result.range} (${result.mode})`);
  lines.push(`**Unsaved commits**: ${String(result.totalUnsaved)}${result.truncated ? ` (showing first ${String(result.commits.length)})` : ''}`);
  lines.push(`**Dirty**: ${result.isDirty ? 'yes' : 'no'}${result.untrackedCount > 0 ? ` (${String(result.untrackedCount)} untracked)` : ''}`);
  lines.push('');

  if (result.commits.length === 0) {
    lines.push('_No unsaved commits._');
  }

  for (const commit of result.commits) {
    lines.push(`---`);
    lines.push(`## ${commit.shortSha} — ${commit.message.split('\n')[0] ?? ''}`);
    lines.push(`**Author**: ${commit.author} | **Date**: ${commit.date}`);
    lines.push('');

    if (commit.message.includes('\n')) {
      const body = commit.message.split('\n').slice(1).join('\n').trim();
      if (body) {
        lines.push(`**Body**:`);
        lines.push(body);
        lines.push('');
      }
    }

    lines.push(`**Files** (${String(commit.files.length)}):`);
    for (const file of commit.files) {
      lines.push(`- ${file}`);
    }
    lines.push('');

    if (commit.diffStat) {
      lines.push(`**Stat**: ${commit.diffStat.split('\n').pop() ?? ''}`);
      lines.push('');
    }

    if (commit.patch !== null) {
      lines.push('**Patch** (minimal):');
      lines.push('```diff');
      lines.push(commit.patch);
      lines.push('```');
      lines.push('');
    }
  }

  if (result.wip) {
    lines.push('---');
    lines.push('## WIP (non-committed)');
    lines.push('');

    if (result.wip.staged) {
      lines.push('### Staged changes');
      lines.push('```');
      lines.push(result.wip.staged);
      lines.push('```');
      lines.push('');
    }

    if (result.wip.unstaged) {
      lines.push('### Unstaged changes');
      lines.push('```');
      lines.push(result.wip.unstaged);
      lines.push('```');
      lines.push('');
    }

    if (result.wip.untrackedFiles.length > 0) {
      lines.push('### Untracked files');
      for (const file of result.wip.untrackedFiles) {
        lines.push(`- ${file}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
