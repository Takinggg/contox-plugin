import * as crypto from 'crypto';
import * as vscode from 'vscode';

/* ═══════════════════════════════════════════════════════════════════════════════
 * TYPE DEFINITIONS — matching the real Contox API response shapes
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface ContoxContext {
  id: string;
  name: string;
  description: string | null;
  content?: string | null;
  status: string;
  files: number;
  tokens: number;
  lastSynced: string;
  projectId: string | null;
  parentContextId?: string | null;
  createdAt?: string;
  updatedAt: string;
}

export interface BrainTreeNode {
  schemaKey: string;
  name: string;
  itemCount: number;
  children: BrainTreeNode[];
}

export interface BrainResponse {
  document: string;
  tokenEstimate: number;
  itemsLoaded: number;
  schemaKeys: string[];
  brainHash: string;
  tree: BrainTreeNode[];
}

export interface ContoxTeam {
  id: string;
  name: string;
  members: number;
  createdAt: string;
}

export interface ContoxProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  teamId: string;
  contextsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContoxSyncResult {
  id: string;
  name: string;
  status: string;
  lastSynced: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * API CLIENT
 * ═══════════════════════════════════════════════════════════════════════════════ */

export class ContoxClient {
  private baseUrl: string;
  private apiKey: string | undefined;

  constructor(private readonly secrets: vscode.SecretStorage) {
    const config = vscode.workspace.getConfiguration('contox');
    this.baseUrl = config.get<string>('apiUrl', 'https://contox.dev');
  }

  /* ── API Key management ─────────────────────────────────────────────────── */

  async setApiKey(key: string): Promise<void> {
    this.apiKey = key;
    await this.secrets.store('contox-api-key', key);
  }

  async getApiKey(): Promise<string | undefined> {
    if (!this.apiKey) {
      this.apiKey = await this.secrets.get('contox-api-key');
    }
    return this.apiKey;
  }

  async clearApiKey(): Promise<void> {
    this.apiKey = undefined;
    await this.secrets.delete('contox-api-key');
  }

  /* ── Generic HTTP helper ────────────────────────────────────────────────── */

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const key = await this.getApiKey();
    if (!key) {
      return { error: 'Not authenticated. Run "Contox: Login" first.' };
    }

    const url = `${this.baseUrl}/api${path}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        const message = typeof body['error'] === 'string' ? body['error'] : response.statusText;
        return { error: message };
      }

      const data = await response.json() as T;
      return { data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: message };
    }
  }

  /* ── Contexts ───────────────────────────────────────────────────────────── */

  /**
   * List contexts for a project via the VS Code integration endpoint.
   * GET /api/integrations/vscode?projectId=xxx
   * Returns { contexts: ContoxContext[], total: number }
   */
  async listContexts(projectId: string): Promise<ApiResponse<ContoxContext[]>> {
    const all: ContoxContext[] = [];
    let offset = 0;
    const limit = 100;

    // Paginate through all contexts
    while (true) {
      const result = await this.request<{ contexts: ContoxContext[]; total: number }>(
        `/integrations/vscode?projectId=${encodeURIComponent(projectId)}&limit=${limit}&offset=${offset}`,
      );
      if (result.error) {
        return { error: result.error };
      }
      const batch = result.data?.contexts ?? [];
      all.push(...batch);

      if (batch.length < limit || all.length >= (result.data?.total ?? 0)) {
        break;
      }
      offset += limit;
    }

    return { data: all };
  }

  /** @deprecated Use getBrain() instead */
  async listContextTree(
    _teamId: string,
    projectId: string,
  ): Promise<ApiResponse<BrainResponse>> {
    return this.getBrain(projectId);
  }

  /**
   * Get a single context with its full content.
   * GET /api/contexts/:id
   */
  async getContext(id: string): Promise<ApiResponse<ContoxContext>> {
    return this.request<ContoxContext>(`/contexts/${encodeURIComponent(id)}`);
  }

  /**
   * Create a new context.
   * POST /api/contexts — requires { name, teamId, projectId }
   */
  async createContext(
    name: string,
    teamId: string,
    projectId: string,
    description?: string,
  ): Promise<ApiResponse<ContoxContext>> {
    return this.request<ContoxContext>('/contexts', {
      method: 'POST',
      body: JSON.stringify({ name, teamId, projectId, description }),
    });
  }

  /**
   * Update a context (e.g. content, name, description).
   * PATCH /api/contexts/:id
   */
  async updateContext(
    id: string,
    data: { name?: string; description?: string; content?: string },
  ): Promise<ApiResponse<ContoxContext>> {
    return this.request<ContoxContext>(`/contexts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Sync content from VS Code into a context via the dedicated integration endpoint.
   * POST /api/integrations/vscode — { contextId, content }
   */
  async syncContent(contextId: string, content: string): Promise<ApiResponse<ContoxSyncResult>> {
    return this.request<ContoxSyncResult>('/integrations/vscode', {
      method: 'POST',
      body: JSON.stringify({ contextId, content }),
    });
  }

  /* ── Teams ─────────────────────────────────────────────────────────────── */

  /**
   * List teams/organizations the authenticated user belongs to.
   * GET /api/orgs — returns { orgs: ContoxTeam[] }
   */
  async listTeams(): Promise<ApiResponse<ContoxTeam[]>> {
    const result = await this.request<{ orgs: ContoxTeam[] }>('/orgs');
    if (result.error) {
      return { error: result.error };
    }
    return { data: result.data?.orgs ?? [] };
  }

  /* ── Projects ───────────────────────────────────────────────────────────── */

  /**
   * List projects for an organization (team).
   * GET /api/projects?teamId=xxx — returns ContoxProject[]
   */
  async listProjects(teamId: string): Promise<ApiResponse<ContoxProject[]>> {
    return this.request<ContoxProject[]>(
      `/projects?teamId=${encodeURIComponent(teamId)}`,
    );
  }

  /**
   * Fetch the per-project HMAC secret for V2 ingest signing.
   * GET /api/projects/:id/hmac-secret
   */
  async getProjectHmacSecret(projectId: string): Promise<ApiResponse<{ hmacSecret: string }>> {
    return this.request<{ hmacSecret: string }>(
      `/projects/${encodeURIComponent(projectId)}/hmac-secret`,
    );
  }

  /* ── V2 Brain (project memory) ────────────────────────────────────── */

  /**
   * Fetch the compiled brain document for a project.
   * GET /api/v2/brain?projectId=xxx
   */
  async getBrain(projectId: string): Promise<ApiResponse<BrainResponse>> {
    return this.request<BrainResponse>(
      `/v2/brain?projectId=${encodeURIComponent(projectId)}`,
    );
  }

  /* ── V2 Sessions (for save monitoring) ───────────────────────────────── */

  /**
   * List recent sessions for a project.
   * GET /api/v2/sessions?projectId=xxx&limit=5
   */
  async listSessions(projectId: string, limit = 5): Promise<ApiResponse<V2SessionsResponse>> {
    return this.request<V2SessionsResponse>(
      `/v2/sessions?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
    );
  }

  /**
   * Get jobs for a session (pipeline status).
   * GET /api/v2/sessions/:sessionId/jobs
   */
  async getSessionJobs(sessionId: string): Promise<ApiResponse<V2JobsResponse>> {
    return this.request<V2JobsResponse>(
      `/v2/sessions/${encodeURIComponent(sessionId)}/jobs`,
    );
  }

  /**
   * Close a session (set status to 'closed').
   * PATCH /api/v2/sessions/:sessionId
   */
  async closeSession(sessionId: string): Promise<ApiResponse<{ ok: boolean; sessionId: string }>> {
    return this.request<{ ok: boolean; sessionId: string }>(
      `/v2/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) },
    );
  }

  /**
   * Find the currently active session for a project (if any).
   */
  async getActiveSession(projectId: string): Promise<ApiResponse<V2Session | null>> {
    const result = await this.listSessions(projectId, 5);
    if (result.error) { return { error: result.error }; }
    const active = result.data?.sessions.find((s) => s.status === 'active') ?? null;
    return { data: active };
  }

  /**
   * Create a new session for a project.
   * POST /api/v2/sessions
   */
  async createSession(projectId: string, source = 'vscode'): Promise<ApiResponse<{ ok: boolean; sessionId: string }>> {
    return this.request<{ ok: boolean; sessionId: string }>(
      '/v2/sessions',
      { method: 'POST', body: JSON.stringify({ projectId, source }) },
    );
  }

  /* ── V2 Ingest (for auto-capture) ─────────────────────────────────────── */

  /**
   * Send captured events to the V2 ingest endpoint.
   * Signs the payload with HMAC-SHA256 and sets skipEnrichment=true
   * so enrichment is deferred to user action in the Dashboard Inbox.
   *
   * POST /api/v2/ingest
   */
  async ingestEvents(
    projectId: string,
    event: VsCodeCaptureEvent,
    hmacSecret: string,
  ): Promise<ApiResponse<IngestResponse>> {
    const eventPayload = JSON.stringify(event);
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = crypto
      .createHmac('sha256', hmacSecret)
      .update(eventPayload)
      .digest('hex');

    const body = {
      source: 'vscode' as const,
      timestamp,
      nonce,
      signature,
      projectId,
      event,
      skipEnrichment: true,
    };

    const key = await this.getApiKey();
    if (!key) {
      return { error: 'Not authenticated. Run "Contox: Login" first.' };
    }

    const url = `${this.baseUrl}/api/v2/ingest`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const respBody = await response.json().catch(() => ({})) as Record<string, unknown>;
        const message = typeof respBody['error'] === 'string' ? respBody['error'] : response.statusText;
        return { error: message };
      }

      const data = await response.json() as IngestResponse;
      return { data };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { error: message };
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * V2 Types
 * ═══════════════════════════════════════════════════════════════════════════════ */

export interface V2Session {
  id: string;
  projectId: string;
  startedAt: string;
  status: string;
  source: string | null;
  messageCount: number;
  summary: string | null;
  updatedAt: string;
}

export interface V2SessionsResponse {
  sessions: V2Session[];
  total: number;
}

export interface V2Job {
  id: string;
  jobType: string;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface V2PipelineSummary {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  status: 'pending' | 'running' | 'done' | 'failed';
}

export interface V2JobsResponse {
  jobs: V2Job[];
  pipeline: V2PipelineSummary;
}

/* ── V2 Ingest types ──────────────────────────────────────────────────── */

export interface VsCodeCaptureCommit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

export interface VsCodeCaptureEvent {
  type: 'vscode_capture';
  commits: VsCodeCaptureCommit[];
  filesModified: string[];
  sessionDurationMs: number;
  activeEditorFiles?: string[];
}

export interface IngestResponse {
  eventId: string;
  sessionId: string;
  status: 'accepted';
  blobIds?: string[];
  enrichmentJobId?: string;
  enrichmentPending?: boolean;
}
