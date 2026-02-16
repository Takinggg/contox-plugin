/* ═══════════════════════════════════════════════════════════════════════════════
 * Brain Populator — Populate the brain hierarchy via the API
 *
 * Used by scanners and CLI tools to upsert brain contexts.
 * All created contexts default to state:'draft' (immutable by default).
 * Generates audit trail via populate_runs.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import type { ContoxApiClient, PopulateNode, PopulateResult } from '../api/client.js';
import { BRAIN_SCHEMA, type BrainNode } from './brain-schema.js';

export interface PopulateInput {
  /** Map of schemaKey → content markdown */
  content: Map<string, string>;
  /** If true, no writes — just return diffStats */
  dryRun?: boolean;
  /** Source identifier (e.g. 'cli-scan', 'mcp-populate') */
  source?: string;
  /** Optional source ref (commit SHA, file path) */
  sourceRef?: string;
}

/**
 * Populate the brain hierarchy with content.
 * Converts a Map<schemaKey, content> into PopulateNode[] and calls the API.
 */
export async function populateBrain(
  client: ContoxApiClient,
  input: PopulateInput,
): Promise<PopulateResult> {
  const nodes = buildPopulateNodes(input.content);

  if (nodes.length === 0) {
    return {
      runId: 'noop',
      dryRun: input.dryRun ?? false,
      created: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
    };
  }

  return client.populate(nodes, input.dryRun, input.source);
}

/**
 * Convert a content map into PopulateNode[] by matching against the brain schema.
 * Nodes are ordered depth-first to ensure parents are created before children.
 */
function buildPopulateNodes(content: Map<string, string>): PopulateNode[] {
  const nodes: PopulateNode[] = [];
  collectNodes(BRAIN_SCHEMA, content, nodes, undefined);
  return nodes;
}

function collectNodes(
  schema: BrainNode,
  content: Map<string, string>,
  out: PopulateNode[],
  parentSchemaKey: string | undefined,
): void {
  const nodeContent = content.get(schema.schemaKey);

  // Only include nodes that have content provided
  if (nodeContent !== undefined) {
    out.push({
      schemaKey: schema.schemaKey,
      name: schema.name,
      content: nodeContent,
      description: schema.description,
      contextType: schema.contextType,
      tier: schema.tier,
      parentSchemaKey,
    });
  }

  if (schema.children) {
    for (const child of schema.children) {
      collectNodes(child, content, out, schema.schemaKey);
    }
  }
}

/**
 * Get all valid schemaKeys from the brain schema.
 * Useful for validation before populating.
 */
export function getValidSchemaKeys(): string[] {
  const keys: string[] = [];
  collectSchemaKeys(BRAIN_SCHEMA, keys);
  return keys;
}

function collectSchemaKeys(node: BrainNode, out: string[]): void {
  out.push(node.schemaKey);
  if (node.children) {
    for (const child of node.children) {
      collectSchemaKeys(child, out);
    }
  }
}
