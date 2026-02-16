/* ═══════════════════════════════════════════════════════════════════════════════
 * On-Call View — Operational summary for the current project
 *
 * Queries recent mutations, populate runs, sessions, and stale drafts.
 * Returns formatted markdown summary.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import type { ContoxApiClient } from '../api/client.js';

export interface OncallOptions {
  since?: string; // ISO date string
}

export async function buildOncallView(
  client: ContoxApiClient,
  options: OncallOptions = {},
): Promise<string> {
  const since = options.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const lines: string[] = [];
  lines.push('# On-Call View');
  lines.push('');
  lines.push(`> Since: ${since}`);
  lines.push('');

  // ── Recent sessions ──────────────────────────────────────────────────
  try {
    const sessionsCtx = await client.findBySchemaKey('root/sessions');
    if (sessionsCtx) {
      const entries = await client.listEntries(sessionsCtx.id, { limit: 5 });
      lines.push('## Recent Sessions');
      lines.push('');
      if (entries.entries.length === 0) {
        lines.push('No recent sessions.');
      } else {
        for (const entry of entries.entries) {
          lines.push(`- **${entry.title}** (${entry.createdAt})`);
          if (entry.tags && entry.tags.length > 0) {
            lines.push(`  Tags: ${entry.tags.join(', ')}`);
          }
        }
      }
      lines.push('');
    }
  } catch {
    lines.push('## Recent Sessions');
    lines.push('');
    lines.push('_Unable to fetch sessions._');
    lines.push('');
  }

  // ── Stale drafts ─────────────────────────────────────────────────────
  try {
    const allContexts = await client.listContexts({ state: 'draft' });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const staleDrafts = allContexts.filter((ctx) => {
      const created = ctx.createdAt ?? '';
      return created < sevenDaysAgo;
    });

    lines.push('## Stale Drafts (>7 days)');
    lines.push('');
    if (staleDrafts.length === 0) {
      lines.push('No stale drafts.');
    } else {
      lines.push(`Found ${staleDrafts.length} stale draft(s):`);
      lines.push('');
      for (const ctx of staleDrafts.slice(0, 10)) {
        lines.push(`- **${ctx.name}** (schemaKey: ${ctx.schemaKey ?? 'none'}, created: ${ctx.createdAt ?? 'unknown'})`);
      }
      if (staleDrafts.length > 10) {
        lines.push(`- ... and ${staleDrafts.length - 10} more`);
      }
    }
    lines.push('');
  } catch {
    lines.push('## Stale Drafts');
    lines.push('');
    lines.push('_Unable to fetch drafts._');
    lines.push('');
  }

  // ── Recent bugs ──────────────────────────────────────────────────────
  try {
    const bugsCtx = await client.findBySchemaKey('root/bugs');
    if (bugsCtx) {
      const entries = await client.listEntries(bugsCtx.id, { limit: 5 });
      lines.push('## Recent Bugs');
      lines.push('');
      if (entries.entries.length === 0) {
        lines.push('No recent bugs recorded.');
      } else {
        for (const entry of entries.entries) {
          lines.push(`- **${entry.title}** (${entry.createdAt})`);
        }
      }
      lines.push('');
    }
  } catch {
    lines.push('## Recent Bugs');
    lines.push('');
    lines.push('_Unable to fetch bugs._');
    lines.push('');
  }

  // ── Brain health summary ─────────────────────────────────────────────
  try {
    const tree = await client.getTree();
    const total = tree.total;
    const allCtxs = await client.listContexts();
    const approved = allCtxs.filter((c) => c.state === 'approved').length;
    const draft = allCtxs.filter((c) => c.state === 'draft').length;
    const deprecated = allCtxs.filter((c) => c.state === 'deprecated').length;

    lines.push('## Brain Health');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total contexts | ${total} |`);
    lines.push(`| Approved | ${approved} |`);
    lines.push(`| Draft | ${draft} |`);
    lines.push(`| Deprecated | ${deprecated} |`);
    lines.push('');
  } catch {
    lines.push('## Brain Health');
    lines.push('');
    lines.push('_Unable to fetch brain stats._');
    lines.push('');
  }

  return lines.join('\n');
}
