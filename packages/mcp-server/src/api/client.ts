/* ═══════════════════════════════════════════════════════════════════════════════
 * Contox API Client — Full CRUD + Brain V5.3 methods
 *
 * Supports: contexts, entries (client ULID), brain (ETag), populate, OCC
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { ulid } from 'ulid';

export interface ContoxContext {
  id: string;
  name: string;
  description: string | null;
  content: string | null;
  status: string;
  files: number;
  tokens: number;
  lastSynced: string;
  projectId: string | null;
  parentContextId: string | null;
  schemaKey: string | null;
  contextType: string | null;
  tier: number | null;
  version: number;
  contentHash: string | null;
  lastEntryAt: string | null;
  state: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContextInput {
  name: string;
  teamId: string;
  projectId: string;
  description?: string;
  parentContextId?: string;
  schemaKey?: string;
  contextType?: string;
  tier?: number;
  state?: string;
}

export interface UpdateContextInput {
  name?: string;
  description?: string;
  content?: string;
  order?: number;
  version?: number;
  contentHash?: string;
  state?: string;
  source?: string;
  sourceRef?: string;
}

export interface ContextEntry {
  id: string;
  contextId: string;
  title: string;
  content: string;
  entryType: string | null;
  tags: string[];
  source: string | null;
  sourceRef: string | null;
  createdAt: string;
}

export interface CreateEntryInput {
  contextId: string;
  title: string;
  content: string;
  entryType?: string;
  tags?: string[];
  idempotencyKey?: string;
  source?: string;
  sourceRef?: string;
}

export interface EntriesListResponse {
  entries: ContextEntry[];
  total: number;
  hasMore: boolean;
  lastId: string | null;
}

export interface BrainDocument {
  document: string;
  tokenEstimate: number;
  loadedContexts: number;
  availableContexts: number;
  brainRevision: string;
  brainHash: string;
  tree: TreeNode[];
}

export interface TreeNode {
  id: string;
  schemaKey: string | null;
  name: string;
  tier: number | null;
  contextType: string | null;
  state: string | null;
  lastEntryAt: string | null;
  children: TreeNode[];
}

export interface PopulateNode {
  schemaKey: string;
  name: string;
  content?: string;
  description?: string;
  contextType?: string;
  tier?: number;
  parentSchemaKey?: string;
}

export interface PopulateResult {
  runId: string;
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
}

export interface ContoxConfig {
  apiKey: string;
  apiUrl: string;
  teamId: string;
  projectId: string;
}

export interface ContentSearchResult {
  id: string;
  name: string;
  description: string | null;
  parentContextId: string | null;
  matchType: string;
  snippets: string[];
}

export class ContoxApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  readonly teamId: string;
  readonly projectId: string;

  // Brain ETag cache
  private brainETag: string | null = null;
  private brainCache: BrainDocument | null = null;
  private brainParamsKey: string | null = null;

  constructor(config?: Partial<ContoxConfig>) {
    this.apiKey = config?.apiKey ?? process.env['CONTOX_API_KEY'] ?? '';
    this.baseUrl = (config?.apiUrl ?? process.env['CONTOX_API_URL'] ?? 'https://contox.dev').replace(/\/$/, '');
    this.teamId = config?.teamId ?? process.env['CONTOX_TEAM_ID'] ?? '';
    this.projectId = config?.projectId ?? process.env['CONTOX_PROJECT_ID'] ?? '';

    if (!this.apiKey) {
      throw new Error('CONTOX_API_KEY is required. Set it as an environment variable.');
    }
    if (!this.teamId) {
      throw new Error('CONTOX_TEAM_ID is required. Set it as an environment variable.');
    }
    if (!this.projectId) {
      throw new Error('CONTOX_PROJECT_ID is required. Set it as an environment variable.');
    }
  }

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
      throw new Error(`API error (${String(response.status)}): ${message}`);
    }

    return response.json() as Promise<T>;
  }

  // ─── Context CRUD ───────────────────────────────────────────────────

  async listContexts(filters?: {
    schemaKey?: string;
    tier?: number;
    state?: string;
    contextType?: string;
    parentContextId?: string;
  }): Promise<ContoxContext[]> {
    const params = new URLSearchParams({
      teamId: this.teamId,
      projectId: this.projectId,
    });
    if (filters?.schemaKey) { params.set('schemaKey', filters.schemaKey); }
    if (filters?.tier !== undefined) { params.set('tier', String(filters.tier)); }
    if (filters?.state) { params.set('state', filters.state); }
    if (filters?.contextType) { params.set('contextType', filters.contextType); }
    if (filters?.parentContextId) { params.set('parentContextId', filters.parentContextId); }

    return this.request<ContoxContext[]>(`/contexts?${params.toString()}`);
  }

  async getContext(id: string): Promise<ContoxContext> {
    return this.request<ContoxContext>(`/contexts/${encodeURIComponent(id)}`);
  }

  async createContext(input: CreateContextInput): Promise<ContoxContext> {
    return this.request<ContoxContext>('/contexts', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateContext(id: string, input: UpdateContextInput): Promise<ContoxContext> {
    return this.request<ContoxContext>(`/contexts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async deleteContext(id: string): Promise<void> {
    await this.request<{ success: boolean }>(`/contexts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  // ─── Context Lookup ─────────────────────────────────────────────────

  async findBySchemaKey(schemaKey: string): Promise<ContoxContext | null> {
    const results = await this.listContexts({ schemaKey });
    return results[0] ?? null;
  }

  async findContextByName(name: string): Promise<ContoxContext | null> {
    const all = await this.listContexts();
    return all.find((ctx) => ctx.name === name) ?? null;
  }

  // ─── Search ─────────────────────────────────────────────────────────

  async searchContexts(query: string): Promise<ContoxContext[]> {
    const all = await this.listContexts();
    const lower = query.toLowerCase();
    return all.filter(
      (ctx) =>
        ctx.name.toLowerCase().includes(lower) ||
        (ctx.description?.toLowerCase().includes(lower) ?? false),
    );
  }

  async searchContent(query: string): Promise<ContentSearchResult[]> {
    return this.request<ContentSearchResult[]>(
      `/contexts/search?q=${encodeURIComponent(query)}&projectId=${encodeURIComponent(this.projectId)}`,
    );
  }

  // ─── Brain (ETag-cached) ────────────────────────────────────────────

  async getBrain(entriesLimit?: Record<string, number>, includeDrafts?: boolean): Promise<BrainDocument> {
    const params = new URLSearchParams({
      teamId: this.teamId,
      projectId: this.projectId,
    });
    if (includeDrafts) { params.set('includeDrafts', 'true'); }
    if (entriesLimit) {
      const limitStr = Object.entries(entriesLimit)
        .map(([k, v]) => `${k}:${String(v)}`)
        .join(',');
      params.set('entriesLimit', limitStr);
    }

    const paramsKey = params.toString();

    // Invalidate cache if params changed
    if (paramsKey !== this.brainParamsKey) {
      this.brainETag = null;
      this.brainCache = null;
      this.brainParamsKey = paramsKey;
    }

    const headers: Record<string, string> = {};
    if (this.brainETag) {
      headers['If-None-Match'] = this.brainETag;
    }

    const url = `${this.baseUrl}/api/contexts/brain?${paramsKey}`;
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
      throw new Error(`API error (${String(response.status)}): ${message}`);
    }

    const brain = await response.json() as BrainDocument;
    this.brainETag = response.headers.get('etag');
    this.brainCache = brain;
    return brain;
  }

  // ─── Entries (client-generated ULID) ────────────────────────────────

  async createEntry(input: CreateEntryInput): Promise<ContextEntry> {
    return this.request<ContextEntry>('/context-entries', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listEntries(contextId: string, opts?: {
    limit?: number;
    cursorAfter?: string;
    entryType?: string;
  }): Promise<EntriesListResponse> {
    const params = new URLSearchParams({ contextId });
    if (opts?.limit) { params.set('limit', String(opts.limit)); }
    if (opts?.cursorAfter) { params.set('cursorAfter', opts.cursorAfter); }
    if (opts?.entryType) { params.set('entryType', opts.entryType); }

    return this.request<EntriesListResponse>(`/context-entries?${params.toString()}`);
  }

  // ─── OCC Update ─────────────────────────────────────────────────────

  async optimisticUpdate(
    id: string,
    updater: (current: string) => string,
    source: string,
    sourceRef?: string,
  ): Promise<ContoxContext> {
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const current = await this.getContext(id);
      const currentContent = current.content ?? '';
      const newContent = updater(currentContent);

      try {
        return await this.updateContext(id, {
          content: newContent,
          version: current.version,
          source,
          sourceRef,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('409') && attempt < maxRetries - 1) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('OCC: max retries exceeded');
  }

  // ─── Populate ───────────────────────────────────────────────────────

  async populate(nodes: PopulateNode[], dryRun?: boolean, source?: string): Promise<PopulateResult> {
    return this.request<PopulateResult>('/contexts/populate', {
      method: 'POST',
      body: JSON.stringify({
        teamId: this.teamId,
        projectId: this.projectId,
        nodes,
        dryRun,
        source,
      }),
    });
  }

  // ─── Approve / Deprecate ────────────────────────────────────────────

  async approveContext(id: string): Promise<void> {
    await this.request(`/contexts/${encodeURIComponent(id)}/approve?action=approve`, {
      method: 'POST',
    });
  }

  async deprecateContext(id: string): Promise<void> {
    await this.request(`/contexts/${encodeURIComponent(id)}/approve?action=deprecate`, {
      method: 'POST',
    });
  }

  // ─── Tree ───────────────────────────────────────────────────────────

  async getTree(): Promise<{ tree: TreeNode[]; total: number }> {
    return this.request(`/contexts/tree?teamId=${encodeURIComponent(this.teamId)}&projectId=${encodeURIComponent(this.projectId)}`);
  }

  // ─── Links ─────────────────────────────────────────────────────────

  async createLink(
    from: string,
    to: string,
    linkType: string,
    reason?: string,
    confidence?: number,
  ): Promise<void> {
    await this.request('/context-links', {
      method: 'POST',
      body: JSON.stringify({
        teamId: this.teamId,
        projectId: this.projectId,
        fromSchemaKey: from,
        toSchemaKey: to,
        linkType,
        reason,
        confidence,
        source: 'mcp',
      }),
    });
  }

  async getLinks(schemaKey: string, direction?: 'both' | 'outgoing' | 'incoming'): Promise<{
    outgoing: Array<{ fromSchemaKey: string; toSchemaKey: string; linkType: string; reason: string | null; confidence: number | null }>;
    incoming: Array<{ fromSchemaKey: string; toSchemaKey: string; linkType: string; reason: string | null; confidence: number | null }>;
  }> {
    const params = new URLSearchParams({
      teamId: this.teamId,
      projectId: this.projectId,
      schemaKey,
    });
    if (direction) { params.set('direction', direction); }
    return this.request(`/context-links?${params.toString()}`);
  }

  // ─── Compaction ───────────────────────────────────────────────────

  async compactContext(id: string): Promise<{
    entriesCount: number;
    summaryLength: number;
    message: string;
  }> {
    return this.request(`/contexts/${encodeURIComponent(id)}/compact`, {
      method: 'POST',
    });
  }

  // ─── ULID generation (exposed for session-analyzer) ─────────────────

  static generateUlid(): string {
    return ulid();
  }
}
