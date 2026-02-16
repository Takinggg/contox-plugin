/* ═══════════════════════════════════════════════════════════════════════════════
 * Explain SchemaKey — Assembles full context about a brain schemaKey
 *
 * Includes: metadata, content, links, entries, related contract, code pointers.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import type { ContoxApiClient } from '../api/client.js';
import { BRAIN_SCHEMA } from './brain-schema.js';
import type { BrainNode } from './brain-schema.js';

function findNode(node: BrainNode, schemaKey: string): BrainNode | null {
  if (node.schemaKey === schemaKey) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, schemaKey);
      if (found) return found;
    }
  }
  return null;
}

export async function explainSchemaKey(
  client: ContoxApiClient,
  schemaKey: string,
): Promise<string> {
  const lines: string[] = [];

  lines.push(`# Explain: ${schemaKey}`);
  lines.push('');

  // ── 1. Schema metadata ────────────────────────────────────────────────
  const node = findNode(BRAIN_SCHEMA, schemaKey);
  if (node) {
    lines.push('## Schema Metadata');
    lines.push('');
    lines.push(`| Property | Value |`);
    lines.push(`|----------|-------|`);
    lines.push(`| SchemaKey | \`${node.schemaKey}\` |`);
    lines.push(`| Name | ${node.name} |`);
    if (node.tier !== undefined) lines.push(`| Tier | ${node.tier} |`);
    if (node.contextType) lines.push(`| Context Type | ${node.contextType} |`);
    if (node.writePolicy) lines.push(`| Write Policy | ${node.writePolicy} |`);
    if (node.storageModel) lines.push(`| Storage Model | ${node.storageModel} |`);
    if (node.description) lines.push(`| Description | ${node.description} |`);
    if (node.children) lines.push(`| Children | ${node.children.length} |`);
    lines.push('');

    if (node.links && node.links.length > 0) {
      lines.push('### Links (Schema-Declared)');
      lines.push('');
      for (const link of node.links) {
        lines.push(`- **${link.linkType}** → \`${link.toSchemaKey}\``);
      }
      lines.push('');
    }
  } else {
    lines.push('> SchemaKey not found in brain-schema.ts');
    lines.push('');
  }

  // ── 2. Context content ─────────────────────────────────────────────────
  try {
    const ctx = await client.findBySchemaKey(schemaKey);
    if (ctx) {
      lines.push('## Context');
      lines.push('');
      lines.push(`| Property | Value |`);
      lines.push(`|----------|-------|`);
      lines.push(`| ID | ${ctx.id} |`);
      lines.push(`| State | ${ctx.state ?? 'unknown'} |`);
      lines.push(`| Version | ${ctx.version ?? 0} |`);
      if (ctx.contentHash) lines.push(`| Content Hash | ${ctx.contentHash.slice(0, 12)}... |`);
      if (ctx.lastEntryAt) lines.push(`| Last Entry | ${ctx.lastEntryAt} |`);
      lines.push('');

      if (ctx.content) {
        const preview = ctx.content.length > 500 ? ctx.content.slice(0, 500) + '...' : ctx.content;
        lines.push('### Content Preview');
        lines.push('');
        lines.push(preview);
        lines.push('');
      }

      // ── 3. Links (runtime) ────────────────────────────────────────────
      try {
        const links = await client.getLinks(schemaKey);
        if (links.outgoing.length > 0 || links.incoming.length > 0) {
          lines.push('## Links (Runtime)');
          lines.push('');
          if (links.outgoing.length > 0) {
            lines.push('**Outgoing:**');
            for (const l of links.outgoing) {
              lines.push(`- ${l.linkType} → \`${l.toSchemaKey}\``);
            }
            lines.push('');
          }
          if (links.incoming.length > 0) {
            lines.push('**Incoming:**');
            for (const l of links.incoming) {
              lines.push(`- ${l.linkType} ← \`${l.fromSchemaKey}\``);
            }
            lines.push('');
          }
        }
      } catch {
        // Links API may not be available
      }

      // ── 4. Recent entries ─────────────────────────────────────────────
      try {
        const entries = await client.listEntries(ctx.id, { limit: 5 });
        if (entries.entries.length > 0) {
          lines.push('## Recent Entries');
          lines.push('');
          for (const entry of entries.entries) {
            lines.push(`### ${entry.title}`);
            lines.push(`> ${entry.entryType ?? 'entry'} | ${entry.createdAt}`);
            const entryPreview = entry.content.length > 200
              ? entry.content.slice(0, 200) + '...'
              : entry.content;
            lines.push(entryPreview);
            lines.push('');
          }
        }
      } catch {
        // Entries may not exist for content-model contexts
      }
    } else {
      lines.push('## Context');
      lines.push('');
      lines.push('_No context found for this schemaKey in the current project._');
      lines.push('');
    }
  } catch (err) {
    lines.push('## Context');
    lines.push('');
    lines.push(`_Error fetching context: ${String(err)}_`);
    lines.push('');
  }

  // ── 5. Related contract ───────────────────────────────────────────────
  if (schemaKey.startsWith('root/contracts/')) {
    lines.push('## Related Contract');
    lines.push('');
    const domain = schemaKey.replace('root/contracts/', '');
    lines.push(`This is a contract domain. See generated contract: \`generated/contracts/${domain}.md\``);
    lines.push('');
  } else {
    // Check if there's a related contract
    const contractDomain = schemaKey.replace('root/', '').split('/')[0];
    if (contractDomain) {
      try {
        const contractCtx = await client.findBySchemaKey(`root/contracts/${contractDomain}`);
        if (contractCtx) {
          lines.push('## Related Contract');
          lines.push('');
          lines.push(`See: \`root/contracts/${contractDomain}\``);
          lines.push('');
        }
      } catch {
        // No related contract
      }
    }
  }

  return lines.join('\n');
}
