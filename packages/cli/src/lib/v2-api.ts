/* ═══════════════════════════════════════════════════════════════════════════════
 * Shared V2 API client for CLI commands
 *
 * Lightweight HTTP wrapper for V2 endpoints (brain, search, ingest, hygiene).
 * Reads credentials from getGlobalConfig() + findProjectConfig().
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { createHmac, randomUUID } from 'node:crypto';
import { getGlobalConfig, findProjectConfig } from './config.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface V2Config {
  apiKey: string;
  baseUrl: string;
  projectId: string;
  teamId: string;
  projectName?: string;
  hmacSecret: string | null;
}

export interface BrainResponse {
  document: string;
  /** Compact summary for CLAUDE.md injection (project brief + key conventions) */
  summary: string;
  tokenEstimate: number;
  itemsLoaded: number;
  schemaKeys: string[];
  brainHash: string;
  tree: BrainTreeNode[];
  /** Item counts per brain layer */
  layers?: {
    layer0: number;
    layer1: number;
    layer2: number;
    archived: number;
  };
}

export interface BrainTreeNode {
  schemaKey: string;
  name: string;
  itemCount: number;
  children: BrainTreeNode[];
}

export interface SearchResult {
  itemId: string;
  type: string;
  title: string;
  facts: string;
  schemaKey: string;
  similarity: number;
  confidence: number;
  files: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalCandidates: number;
}

export interface IngestResponse {
  eventId: string;
  sessionId: string;
  status: 'accepted';
  enrichmentJobId?: string;
}

// ── Config ───────────────────────────────────────────────────────────────────

export function createV2Config(): V2Config | null {
  const global = getGlobalConfig();
  if (!global) { return null; }

  const project = findProjectConfig();
  if (!project) { return null; }

  return {
    apiKey: global.apiKey,
    baseUrl: global.apiUrl.replace(/\/$/, ''),
    projectId: project.projectId,
    teamId: project.teamId,
    projectName: project.projectName,
    // Per-project secret from .contoxrc (written by VS Code setup), then env var fallback
    hmacSecret: global.hmacSecret ?? process.env['V2_HMAC_SECRET_CLI'] ?? process.env['V2_HMAC_SECRET'] ?? null,
  };
}

// ── API helpers ──────────────────────────────────────────────────────────────

function authHeaders(config: V2Config): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };
}

export async function v2GetBrain(
  config: V2Config,
  opts?: { tokenBudget?: number },
): Promise<BrainResponse> {
  const params = new URLSearchParams({ projectId: config.projectId });
  if (opts?.tokenBudget !== undefined) {
    params.set('tokenBudget', String(opts.tokenBudget));
  }

  const url = `${config.baseUrl}/api/v2/brain?${params.toString()}`;
  const res = await fetch(url, { headers: authHeaders(config) });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof body['error'] === 'string' ? body['error'] : res.statusText;
    throw new Error(`Brain API error (${String(res.status)}): ${msg}`);
  }

  return res.json() as Promise<BrainResponse>;
}

export async function v2Search(
  config: V2Config,
  query: string,
  opts?: { limit?: number; minSimilarity?: number },
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    projectId: config.projectId,
    q: query,
  });
  if (opts?.limit !== undefined) { params.set('limit', String(opts.limit)); }
  if (opts?.minSimilarity !== undefined) { params.set('minSimilarity', String(opts.minSimilarity)); }

  const url = `${config.baseUrl}/api/v2/search?${params.toString()}`;
  const res = await fetch(url, { headers: authHeaders(config) });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof body['error'] === 'string' ? body['error'] : res.statusText;
    throw new Error(`Search API error (${String(res.status)}): ${msg}`);
  }

  return res.json() as Promise<SearchResponse>;
}

export async function v2Ingest(
  config: V2Config,
  event: Record<string, unknown>,
): Promise<IngestResponse> {
  if (!config.hmacSecret) {
    throw new Error('V2_HMAC_SECRET is required for V2 ingest. Set V2_HMAC_SECRET_CLI or V2_HMAC_SECRET env var.');
  }

  const eventPayload = JSON.stringify(event);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = createHmac('sha256', config.hmacSecret)
    .update(eventPayload)
    .digest('hex');

  const url = `${config.baseUrl}/api/v2/ingest`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({
      source: 'cli',
      timestamp,
      nonce,
      signature,
      projectId: config.projectId,
      event,
      skipEnrichment: true,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof body['error'] === 'string' ? body['error'] : res.statusText;
    throw new Error(`Ingest API error (${String(res.status)}): ${msg}`);
  }

  return res.json() as Promise<IngestResponse>;
}

// ── Hygiene ─────────────────────────────────────────────────────────────────

export interface HygieneAnalyzeResponse {
  planVersion: string;
  summary: string;
  actions: HygieneAction[];
  metrics: { totalMemories: number; actionsCount: number; byType: Record<string, number> };
  warnings: string[];
  usage: { promptTokens: number; completionTokens: number };
}

export interface HygieneAction {
  actionId: string;
  type: string;
  targetMemoryIds: string[];
  reason: string;
  confidence: number;
  requiresHumanApproval: boolean;
  patch?: Record<string, unknown>;
  merge?: Record<string, unknown>;
  deprecate?: { reason: string; supersededByMemoryId: string };
  links?: { fromMemoryId: string; toMemoryId: string; relation: string }[];
  redactions?: { memoryId: string; field: string; pattern: string }[];
}

export interface HygieneApplyResponse {
  appliedActionIds: string[];
  skippedActionIds: string[];
  errors: { actionId: string; message: string }[];
}

export async function v2AnalyzeHygiene(
  config: V2Config,
  opts: { mode: 'quick' | 'weekly'; schemaKeyPrefix?: string },
): Promise<HygieneAnalyzeResponse> {
  const url = `${config.baseUrl}/api/v2/hygiene`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({
      action: 'analyze',
      mode: opts.mode,
      scope: { teamId: config.teamId, projectId: config.projectId },
      filters: opts.schemaKeyPrefix ? { schemaKeyPrefix: opts.schemaKeyPrefix } : undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof body['error'] === 'string' ? body['error'] : res.statusText;
    throw new Error(`Hygiene analyze error (${String(res.status)}): ${msg}`);
  }

  return res.json() as Promise<HygieneAnalyzeResponse>;
}

export async function v2ApplyHygiene(
  config: V2Config,
  opts: { plan: HygieneAnalyzeResponse; selectedActionIds: string[]; dryRun?: boolean },
): Promise<HygieneApplyResponse> {
  const url = `${config.baseUrl}/api/v2/hygiene`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({
      action: 'apply',
      scope: { teamId: config.teamId, projectId: config.projectId },
      plan: opts.plan,
      selectedActionIds: opts.selectedActionIds,
      dryRun: opts.dryRun ?? false,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const msg = typeof body['error'] === 'string' ? body['error'] : res.statusText;
    throw new Error(`Hygiene apply error (${String(res.status)}): ${msg}`);
  }

  return res.json() as Promise<HygieneApplyResponse>;
}
