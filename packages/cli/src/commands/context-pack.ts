/* ═══════════════════════════════════════════════════════════════════════════════
 * CLI: contox context — Build a context pack via V2 API
 *
 * Fetches the brain document and optionally performs semantic search
 * to build a focused context pack. Outputs markdown to stdout.
 *
 * Includes a local file-based cache (5 min TTL) so Claude Code hooks
 * can call this on every PreToolUse without excessive API latency.
 *
 * Usage:
 *   contox context --task "implement auth" --scope relevant --budget 4000
 *   contox context --scope minimal --budget 1000 --task "session start"
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { Command } from 'commander';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import chalk from 'chalk';

import { createV2Config, v2GetBrain, v2Search } from '../lib/v2-api.js';
import type { SearchResponse } from '../lib/v2-api.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Cache helpers ─────────────────────────────────────────────────────────

function getCacheDir(): string {
  return join(tmpdir(), 'contox-context-cache');
}

function getCacheKey(task: string, scope: string, budget: number): string {
  const hash = createHash('sha256').update(`${task}:${scope}:${String(budget)}`).digest('hex').slice(0, 12);
  return hash;
}

interface CacheEntry {
  content: string;
  createdAt: number;
}

async function readCache(key: string): Promise<string | null> {
  try {
    const filePath = join(getCacheDir(), `${key}.json`);
    const raw = await readFile(filePath, 'utf-8');
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.createdAt < CACHE_TTL_MS) {
      return entry.content;
    }
  } catch {
    // Cache miss
  }
  return null;
}

async function writeCache(key: string, content: string): Promise<void> {
  try {
    const dir = getCacheDir();
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    const entry: CacheEntry = { content, createdAt: Date.now() };
    await writeFile(join(dir, `${key}.json`), JSON.stringify(entry), 'utf-8');
  } catch {
    // Non-critical
  }
}

// ── Main command ──────────────────────────────────────────────────────────

export const contextCommand = new Command('context')
  .description('Build a context pack for a task (V2)')
  .option('--task <task>', 'Task description for semantic search')
  .option('--scope <scope>', 'Scope: full, relevant, minimal', 'relevant')
  .option('--budget <tokens>', 'Token budget', '4000')
  .option('--active-files <files>', 'Comma-separated active file paths for boosting')
  .option('--no-cache', 'Skip local cache')
  .action(async (opts: { task?: string; scope: string; budget: string; activeFiles?: string; cache: boolean }) => {
    const config = createV2Config();
    if (!config) {
      // Silent failure for hooks — write nothing to stdout
      process.exitCode = 1;
      return;
    }

    const budget = parseInt(opts.budget, 10);
    const useCache = opts.cache !== false;

    // Check cache first
    if (useCache && opts.task) {
      const cacheKey = getCacheKey(opts.task, opts.scope, budget);
      const cached = await readCache(cacheKey);
      if (cached) {
        process.stdout.write(cached);
        return;
      }
    }

    try {
      if (opts.scope === 'full' || !opts.task) {
        // Full brain document
        const brain = await v2GetBrain(config);
        const maxChars = budget * 4;

        let output: string;
        if (brain.document.length <= maxChars) {
          output = brain.document;
        } else {
          output = brain.document.slice(0, maxChars) + '\n\n_[truncated to fit budget]_\n';
        }

        process.stdout.write(output);
        console.error(chalk.dim(`\n--- ${String(brain.itemsLoaded)} items, ~${String(brain.tokenEstimate)} tokens ---`));
        return;
      }

      // Relevant: semantic search
      let searchData: SearchResponse;
      try {
        searchData = await v2Search(config, opts.task, { limit: 15, minSimilarity: 0.6 });
      } catch {
        // Fallback to full brain
        console.error(chalk.dim('Search unavailable, falling back to full brain'));
        const brain = await v2GetBrain(config);
        process.stdout.write(brain.document.slice(0, budget * 4));
        return;
      }

      if (searchData.results.length === 0) {
        console.error(chalk.dim('No relevant results, showing top items'));
        const brain = await v2GetBrain(config);
        process.stdout.write(brain.document.slice(0, budget * 4));
        return;
      }

      // Build context pack from search results
      const parts: string[] = [];
      parts.push('# Context Pack\n');
      parts.push(`> Task: ${opts.task}`);
      parts.push(`> ${String(searchData.results.length)} relevant items (${String(searchData.totalCandidates)} candidates)\n`);

      for (const r of searchData.results) {
        const section = [
          `### ${r.title}`,
          `> ${r.type} | sim: ${r.similarity.toFixed(3)} | conf: ${r.confidence.toFixed(2)}`,
          r.files.length > 0 ? `> files: ${r.files.slice(0, 5).join(', ')}` : '',
          '',
          r.facts,
          '',
        ].filter(Boolean).join('\n');

        if (estimateTokens(parts.join('\n') + section) > budget) {
          break;
        }
        parts.push(section);
      }

      const output = parts.join('\n');
      process.stdout.write(output);
      console.error(chalk.dim(`\n--- ~${String(estimateTokens(output))} tokens ---`));

      // Write to cache
      if (useCache) {
        const cacheKey = getCacheKey(opts.task, opts.scope, budget);
        void writeCache(cacheKey, output);
      }
    } catch (err) {
      // Silent failure for hooks — don't crash the agent
      console.error(chalk.dim(`context-pack: ${String(err)}`));
      process.exitCode = 1;
    }
  });

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
