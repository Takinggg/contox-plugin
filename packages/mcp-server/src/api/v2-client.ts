/* ═══════════════════════════════════════════════════════════════════════════════
 * V2 API Client — Calls V2 endpoints (brain, search, items, ingest)
 *
 * Lightweight HTTP client with Bearer auth and ETag caching for brain.
 * Used by MCP server tools when CONTOX_V2=true.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { createHmac, randomUUID } from 'node:crypto';

// ── Response Types ──────────────────────────────────────────────────────────

export interface V2BrainResponse {
  document: string;
  /** Compact summary for CLAUDE.md injection (project brief + key conventions) */
  summary: string;
  tokenEstimate: number;
  itemsLoaded: number;
  schemaKeys: string[];
  brainHash: string;
  tree: V2TreeNode[];
  /** Item counts per brain layer */
  layers?: {
    layer0: number;
    layer1: number;
    layer2: number;
    archived: number;
  };
}

export interface V2TreeNode {
  schemaKey: string;
  name: string;
  itemCount: number;
  children: V2TreeNode[];
}

export interface V2SearchResult {
  itemId: string;
  type: string;
  title: string;
  facts: string;
  schemaKey: string;
  similarity: number;
  confidence: number;
  files: string[];
  compositeScore?: number;
}

export interface V2SearchResponse {
  results: V2SearchResult[];
  query: string;
  totalCandidates: number;
}

export interface V2ItemSummary {
  itemId: string;
  projectId: string;
  type: string;
  title: string;
  facts: string;
  rationale: string | null;
  impact: string | null;
  files: string[];
  schemaKey: string;
  confidence: number;
  importance: number | null;
  tags: string[];
  dedupHint: string | null;
  status: string;
  sessionId: string;
  mergedFrom: string[];
  supersededBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface V2ItemsResponse {
  items: V2ItemSummary[];
  total: number;
  hasMore: boolean;
}

export interface V2IngestResponse {
  eventId: string;
  sessionId: string;
  status: 'accepted';
  enrichmentJobId?: string;
}

export interface V2HygieneAction {
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

export interface V2HygieneAnalyzeResponse {
  planVersion: string;
  summary: string;
  actions: V2HygieneAction[];
  metrics: { totalMemories: number; actionsCount: number; byType: Record<string, number> };
  warnings: string[];
  usage: { promptTokens: number; completionTokens: number };
}

export interface V2HygieneApplyResponse {
  appliedActionIds: string[];
  skippedActionIds: string[];
  errors: { actionId: string; message: string }[];
}

export interface V2AskResponse {
  answer: string;
  sources: V2SearchResult[];
  avgSimilarity: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  model: string;
}

export interface V2DriftDetail {
  convention: string;
  baselineItemId: string;
  violation: string;
  files: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface V2DriftCheckResponse {
  message: string;
  driftsDetected: number;
  itemsChecked: number;
  baselineSize: number;
  details: V2DriftDetail[];
  usage: { promptTokens: number; completionTokens: number };
}

export interface V2DriftProblemsResponse {
  problems: {
    id: string;
    kind: 'drift';
    description: string;
    itemIds: string[];
    severity: string;
    status: string;
    createdAt: string;
  }[];
  total: number;
}

export interface V2ImpactModule {
  module: string;
  directChanges: number;
  rippleFrom: string[];
  riskLevel: string;
  reason: string;
  files: string[];
}

export interface V2ImpactResponse {
  message: string;
  modules: V2ImpactModule[];
  totalFilesChanged: number;
  modulesAffected: number;
  rippleCount: number;
  changesAnalyzed: number;
  usage: { promptTokens: number; completionTokens: number };
}

export interface V2ChangelogEntry {
  date: string;
  summary: string;
  changelog: string;
  risks: string[];
  impacts: string[];
  sessionCount: number;
  filesModified: string[];
}

export interface V2ChangelogResponse {
  entries: V2ChangelogEntry[];
  total: number;
  hasMore: boolean;
  mode: string;
  range: { since: string; until: string };
}

export interface V2OnboardingGuideSection {
  id: string;
  title: string;
  content: string;
  keyFiles: string[];
}

export interface V2OnboardingGuide {
  sections: V2OnboardingGuideSection[];
  generatedAt: string;
  itemsUsed: number;
  usage: { promptTokens: number; completionTokens: number };
}

export interface V2OnboardingGuideResponse {
  guide: V2OnboardingGuide;
  projectName: string;
}

export interface V2AutoResolveCommit {
  sha: string;
  message: string;
  files: string[];
}

export interface V2AutoResolveResult {
  itemId: string;
  title: string;
  type: string;
  matchType: 'file' | 'keyword' | 'both';
  matchedFiles: string[];
  confidence: number;
  commitSha: string;
  previousStatus: string;
  newStatus: string;
}

export interface V2AutoResolveResponse {
  resolved: V2AutoResolveResult[];
  skipped: { itemId: string; title: string; reason: string }[];
  totalItemsScanned: number;
  dryRun: boolean;
}

// ── Client ──────────────────────────────────────────────────────────────────

export class V2Client {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  readonly projectId: string;
  private readonly hmacSecret: string | null;

  // Brain ETag cache
  private brainETag: string | null = null;
  private brainCache: V2BrainResponse | null = null;

  constructor(config: {
    apiUrl?: string;
    apiKey: string;
    projectId: string;
    hmacSecret?: string;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.apiUrl ?? 'https://contox.dev').replace(/\/$/, '');
    this.projectId = config.projectId;
    this.hmacSecret = config.hmacSecret ?? null;
  }

  // ── Brain ───────────────────────────────────────────────────────────────

  async getBrain(opts?: {
    minConfidence?: number;
    limit?: number;
    tokenBudget?: number;
    activeFiles?: string[];
  }): Promise<V2BrainResponse> {
    const params = new URLSearchParams({ projectId: this.projectId });
    if (opts?.minConfidence !== undefined) {
      params.set('minConfidence', String(opts.minConfidence));
    }
    if (opts?.limit !== undefined) {
      params.set('limit', String(opts.limit));
    }
    if (opts?.tokenBudget !== undefined) {
      params.set('tokenBudget', String(opts.tokenBudget));
    }
    if (opts?.activeFiles && opts.activeFiles.length > 0) {
      params.set('activeFiles', opts.activeFiles.join(','));
    }

    const headers: Record<string, string> = {};
    if (this.brainETag) {
      headers['If-None-Match'] = this.brainETag;
    }

    const url = `${this.baseUrl}/api/v2/brain?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...headers,
      },
    });

    if (response.status === 304 && this.brainCache) {
      return this.brainCache;
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const message = typeof body['error'] === 'string' ? body['error'] : response.statusText;
      throw new Error(`V2 brain error (${String(response.status)}): ${message}`);
    }

    const brain = await response.json() as V2BrainResponse;
    this.brainETag = response.headers.get('etag');
    this.brainCache = brain;
    return brain;
  }

  // ── Search ──────────────────────────────────────────────────────────────

  async search(query: string, opts?: {
    limit?: number;
    minSimilarity?: number;
    activeFiles?: string[];
  }): Promise<V2SearchResponse> {
    const params = new URLSearchParams({
      projectId: this.projectId,
      q: query,
    });
    if (opts?.limit !== undefined) {
      params.set('limit', String(opts.limit));
    }
    if (opts?.minSimilarity !== undefined) {
      params.set('minSimilarity', String(opts.minSimilarity));
    }
    if (opts?.activeFiles && opts.activeFiles.length > 0) {
      params.set('activeFiles', opts.activeFiles.join(','));
      params.set('useCompositeScore', 'true');
    }

    return this.request<V2SearchResponse>(`/v2/search?${params.toString()}`);
  }

  // ── Items ───────────────────────────────────────────────────────────────

  async listItems(opts?: {
    type?: string;
    schemaKey?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<V2ItemsResponse> {
    const params = new URLSearchParams({ projectId: this.projectId });
    if (opts?.type) { params.set('type', opts.type); }
    if (opts?.schemaKey) { params.set('schemaKey', opts.schemaKey); }
    if (opts?.status) { params.set('status', opts.status); }
    if (opts?.limit !== undefined) { params.set('limit', String(opts.limit)); }
    if (opts?.offset !== undefined) { params.set('offset', String(opts.offset)); }

    return this.request<V2ItemsResponse>(`/v2/items?${params.toString()}`);
  }

  async getItem(id: string, includeEmbedding?: boolean): Promise<V2ItemSummary> {
    const params = includeEmbedding ? '?includeEmbedding=true' : '';
    return this.request<V2ItemSummary>(`/v2/items/${encodeURIComponent(id)}${params}`);
  }

  // ── Ingest (V2 pipeline) ────────────────────────────────────────────────

  async ingest(event: {
    type: 'mcp_save';
    summary: string;
    changes: { category: string; title: string; content: string }[];
    headCommitSha?: string;
  }): Promise<V2IngestResponse> {
    if (!this.hmacSecret) {
      throw new Error('V2_HMAC_SECRET is required for V2 ingest');
    }

    const eventPayload = JSON.stringify(event);
    const timestamp = new Date().toISOString();
    const nonce = randomUUID();
    const signature = createHmac('sha256', this.hmacSecret)
      .update(eventPayload)
      .digest('hex');

    return this.request<V2IngestResponse>('/v2/ingest', {
      method: 'POST',
      body: JSON.stringify({
        source: 'mcp-server',
        timestamp,
        nonce,
        signature,
        projectId: this.projectId,
        event,
        skipEnrichment: true,
      }),
    });
  }

  // ── Hygiene ────────────────────────────────────────────────────────────

  async analyzeHygiene(opts: {
    mode: 'quick' | 'weekly';
    teamId: string;
    schemaKeyPrefix?: string;
  }): Promise<V2HygieneAnalyzeResponse> {
    return this.request<V2HygieneAnalyzeResponse>('/v2/hygiene', {
      method: 'POST',
      body: JSON.stringify({
        action: 'analyze',
        mode: opts.mode,
        scope: { teamId: opts.teamId, projectId: this.projectId },
        filters: opts.schemaKeyPrefix ? { schemaKeyPrefix: opts.schemaKeyPrefix } : undefined,
      }),
    });
  }

  async applyHygiene(opts: {
    teamId: string;
    plan: V2HygieneAnalyzeResponse;
    selectedActionIds: string[];
    dryRun?: boolean;
  }): Promise<V2HygieneApplyResponse> {
    return this.request<V2HygieneApplyResponse>('/v2/hygiene', {
      method: 'POST',
      body: JSON.stringify({
        action: 'apply',
        scope: { teamId: opts.teamId, projectId: this.projectId },
        plan: opts.plan,
        selectedActionIds: opts.selectedActionIds,
        dryRun: opts.dryRun ?? false,
      }),
    });
  }

  // ── Auto-Resolve ──────────────────────────────────────────────────────

  async autoResolve(
    commits: V2AutoResolveCommit[],
    dryRun?: boolean,
  ): Promise<V2AutoResolveResponse> {
    return this.request<V2AutoResolveResponse>('/v2/auto-resolve', {
      method: 'POST',
      body: JSON.stringify({
        projectId: this.projectId,
        commits,
        dryRun: dryRun ?? false,
      }),
    });
  }

  // ── Drift Check ──────────────────────────────────────────────────────

  async driftCheck(): Promise<V2DriftCheckResponse> {
    return this.request<V2DriftCheckResponse>(
      `/v2/projects/${encodeURIComponent(this.projectId)}/drift-check`,
      { method: 'POST' },
    );
  }

  async getDriftProblems(): Promise<V2DriftProblemsResponse> {
    return this.request<V2DriftProblemsResponse>(
      `/v2/projects/${encodeURIComponent(this.projectId)}/drift-check`,
    );
  }

  // ── Onboarding Guide ─────────────────────────────────────────────────

  async generateOnboardingGuide(): Promise<V2OnboardingGuideResponse> {
    return this.request<V2OnboardingGuideResponse>(
      `/v2/projects/${encodeURIComponent(this.projectId)}/onboarding-guide`,
      { method: 'POST' },
    );
  }

  // ── Changelog ────────────────────────────────────────────────────────

  async getChangelog(opts?: {
    mode?: string;
    days?: number;
  }): Promise<V2ChangelogResponse> {
    const since = new Date(Date.now() - (opts?.days ?? 30) * 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      mode: opts?.mode ?? 'developer',
      since,
      limit: '200',
    });
    return this.request<V2ChangelogResponse>(
      `/v2/projects/${encodeURIComponent(this.projectId)}/changelog?${params.toString()}`,
    );
  }

  // ── Impact Radar ──────────────────────────────────────────────────────

  async analyzeImpact(days?: number): Promise<V2ImpactResponse> {
    const qs = days ? `?days=${String(days)}` : '';
    return this.request<V2ImpactResponse>(
      `/v2/projects/${encodeURIComponent(this.projectId)}/impact${qs}`,
      { method: 'POST' },
    );
  }

  // ── Ask ────────────────────────────────────────────────────────────────

  async ask(question: string): Promise<V2AskResponse> {
    return this.request<V2AskResponse>('/v2/ask', {
      method: 'POST',
      body: JSON.stringify({ projectId: this.projectId, question, mode: 'sync' }),
    });
  }

  // ── Private request helper ──────────────────────────────────────────────

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as Record<string, unknown>;
      const message = typeof body['error'] === 'string' ? body['error'] : response.statusText;
      throw new Error(`V2 API error (${String(response.status)}): ${message}`);
    }

    return response.json() as Promise<T>;
  }
}
