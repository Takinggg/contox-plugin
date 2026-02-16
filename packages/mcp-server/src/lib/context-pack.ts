/* ═══════════════════════════════════════════════════════════════════════════════
 * Context Pack Assembler — Smart context budgeting via V2 API
 *
 * Builds a focused markdown document that fits within a token budget.
 * Uses semantic search for "relevant" scope, full brain for "full",
 * and top-confidence items for "minimal".
 * ═══════════════════════════════════════════════════════════════════════════════ */

import type { V2Client, V2SearchResult } from '../api/v2-client.js';

export interface ContextPackOptions {
  task: string;
  scope: 'full' | 'relevant' | 'minimal';
  tokenBudget: number;
}

/** Rough token estimate: 1 token ≈ 4 chars */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Assemble a context pack — a token-budgeted markdown document
 * with the most relevant project memory for the current task.
 */
export async function assembleContextPack(
  v2: V2Client,
  opts: ContextPackOptions,
): Promise<string> {
  const { task, scope, tokenBudget } = opts;
  const parts: string[] = [];

  // Header
  parts.push('# Context Pack\n');
  parts.push(`> Task: ${task}`);
  parts.push(`> Scope: ${scope} | Budget: ~${String(tokenBudget)} tokens\n`);

  const headerTokens = estimateTokens(parts.join('\n'));
  const remainingBudget = tokenBudget - headerTokens - 50; // reserve for footer

  if (scope === 'full') {
    // Full brain document, pre-budgeted by the assembler
    const brain = await v2.getBrain({ tokenBudget: remainingBudget });
    parts.push(brain.document);

    const layers = brain.layers
      ? ` | L1: ${String(brain.layers.layer1)}, L2: ${String(brain.layers.layer2)}, archived: ${String(brain.layers.archived)}`
      : '';
    parts.push(`\n---\n_${String(brain.itemsLoaded)} items${layers} | ~${String(estimateTokens(parts.join('\n')))} tokens_`);
    return parts.join('\n');
  }

  if (scope === 'minimal') {
    // Top 5 highest-confidence items
    const items = await v2.listItems({ limit: 5 });
    if (items.items.length === 0) {
      parts.push('_No memory items yet._');
      return parts.join('\n');
    }

    for (const item of items.items) {
      const section = formatItem(item);
      if (estimateTokens(parts.join('\n') + section) > tokenBudget) {
        break;
      }
      parts.push(section);
    }

    parts.push(`\n---\n_${String(items.items.length)} items (minimal) | ~${String(estimateTokens(parts.join('\n')))} tokens_`);
    return parts.join('\n');
  }

  // scope === 'relevant': project brief + semantic search
  // Always prepend project brief for baseline context
  try {
    const brain = await v2.getBrain();
    if (brain.summary) {
      parts.push(brain.summary);
      parts.push('');
    }
  } catch {
    // Non-critical — proceed without brief
  }

  let searchResults: V2SearchResult[] = [];

  try {
    const searchResponse = await v2.search(task, { limit: 15, minSimilarity: 0.6 });
    searchResults = searchResponse.results;
  } catch {
    // Semantic search unavailable — fall back to full brain
    try {
      const brain = await v2.getBrain({ tokenBudget: remainingBudget });
      parts.push(brain.document);
      parts.push(`\n---\n_Fallback: full brain (search unavailable) | ~${String(estimateTokens(parts.join('\n')))} tokens_`);
      return parts.join('\n');
    } catch {
      parts.push('_Search and brain unavailable. Use `contox_get_memory` to load project memory._');
      return parts.join('\n');
    }
  }

  if (searchResults.length === 0) {
    // No relevant results — return minimal brain
    const brain = await v2.getBrain({ limit: 20, tokenBudget: remainingBudget });
    parts.push(brain.document);
    parts.push(`\n---\n_No semantic matches — showing top items | ~${String(estimateTokens(parts.join('\n')))} tokens_`);
    return parts.join('\n');
  }

  // Group results by schemaKey prefix
  const groups = new Map<string, V2SearchResult[]>();
  for (const r of searchResults) {
    const prefix = r.schemaKey.split('/').slice(0, 2).join('/');
    const group = groups.get(prefix) ?? [];
    group.push(r);
    groups.set(prefix, group);
  }

  for (const [groupKey, items] of groups) {
    const label = groupKey.split('/').pop() ?? groupKey;
    const sectionHeader = `## ${label.charAt(0).toUpperCase()}${label.slice(1)}\n`;

    if (estimateTokens(parts.join('\n') + sectionHeader) > tokenBudget) {
      break;
    }
    parts.push(sectionHeader);

    for (const item of items) {
      const section = formatSearchResult(item);
      if (estimateTokens(parts.join('\n') + section) > tokenBudget) {
        break;
      }
      parts.push(section);
    }
  }

  parts.push(`\n---\n_${String(searchResults.length)} relevant items | ~${String(estimateTokens(parts.join('\n')))} tokens_`);
  return parts.join('\n');
}

function formatItem(item: { title: string; facts: string; confidence: number; schemaKey: string; files: string[] }): string {
  const lines: string[] = [];
  lines.push(`### ${item.title}`);
  lines.push(`> confidence: ${item.confidence.toFixed(2)} | ${item.schemaKey}`);
  if (item.files.length > 0) {
    lines.push(`> files: ${item.files.slice(0, 5).join(', ')}`);
  }
  lines.push('');
  lines.push(item.facts);
  lines.push('');
  return lines.join('\n');
}

function formatSearchResult(r: V2SearchResult): string {
  const lines: string[] = [];
  lines.push(`### ${r.title}`);
  lines.push(`> similarity: ${r.similarity.toFixed(3)} | confidence: ${r.confidence.toFixed(2)} | ${r.type}`);
  if (r.files.length > 0) {
    lines.push(`> files: ${r.files.slice(0, 5).join(', ')}`);
  }
  lines.push('');
  lines.push(r.facts);
  lines.push('');
  return lines.join('\n');
}
