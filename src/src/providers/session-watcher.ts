import * as vscode from 'vscode';
import { ContoxClient } from '../api/client';
import type { V2Session, V2PipelineSummary } from '../api/client';
import { StatusBarManager } from './status-bar';
import type { GitWatcher } from './git-watcher';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Session Watcher — Polls for new saves, shows notifications + pipeline status
 *
 * - Polls GET /api/v2/sessions every 30s
 * - Detects new sessions and shows VS Code notifications
 * - Tracks pipeline progress for active sessions
 * - Updates status bar with last save time
 * ═══════════════════════════════════════════════════════════════════════════════ */

const SESSIONS_POLL_INTERVAL = 30_000; // 30s
const PIPELINE_POLL_INTERVAL = 5_000;  // 5s when pipeline active

const JOB_LABELS: Record<string, string> = {
  enrich: 'Enrichment',
  embed: 'Embedding',
  dedup: 'Deduplication',
  drift_check: 'Drift Check',
};

function pipelineIcon(status: string): string {
  switch (status) {
    case 'done': return '$(check)';
    case 'failed': return '$(error)';
    case 'running': return '$(sync~spin)';
    default: return '$(clock)';
  }
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) { return 'just now'; }
  const mins = Math.floor(secs / 60);
  if (mins < 60) { return `${mins}m ago`; }
  const hours = Math.floor(mins / 60);
  if (hours < 24) { return `${hours}h ago`; }
  return `${Math.floor(hours / 24)}d ago`;
}

export class SessionWatcher implements vscode.Disposable {
  private sessionsTimer: ReturnType<typeof setInterval> | undefined;
  private pipelineTimer: ReturnType<typeof setInterval> | undefined;
  private knownSessionIds = new Set<string>();
  private isFirstPoll = true;
  private activeSessionId: string | null = null;
  private trackedActiveSessionId: string | null = null;
  private lastSaveTime: string | null = null;
  private projectId: string | null = null;
  private disposed = false;
  private gitWatcher: GitWatcher | null = null;

  constructor(
    private readonly client: ContoxClient,
    private readonly statusBar: StatusBarManager,
  ) {}

  /**
   * Link the GitWatcher so we can reset its buffer when an external
   * session close is detected (e.g. from the dashboard "Generate Memory").
   */
  setGitWatcher(watcher: GitWatcher): void {
    this.gitWatcher = watcher;
  }

  /**
   * Start watching a project for new saves.
   */
  start(projectId: string): void {
    this.stop();
    this.projectId = projectId;
    this.isFirstPoll = true;
    this.knownSessionIds.clear();

    // Immediate first poll
    void this.pollSessions();

    // Start interval
    this.sessionsTimer = setInterval(() => {
      void this.pollSessions();
    }, SESSIONS_POLL_INTERVAL);
  }

  /**
   * Stop all polling.
   */
  stop(): void {
    if (this.sessionsTimer) {
      clearInterval(this.sessionsTimer);
      this.sessionsTimer = undefined;
    }
    this.stopPipelinePolling();
    this.projectId = null;
  }

  private stopPipelinePolling(): void {
    if (this.pipelineTimer) {
      clearInterval(this.pipelineTimer);
      this.pipelineTimer = undefined;
    }
    this.activeSessionId = null;
  }

  /* ── Sessions polling ────────────────────────────────────────────────── */

  private async pollSessions(): Promise<void> {
    if (this.disposed || !this.projectId) { return; }

    const result = await this.client.listSessions(this.projectId, 5);
    if (result.error || !result.data) { return; }

    const sessions = result.data.sessions;

    // Update last save time from most recent session
    if (sessions.length > 0) {
      const latest = sessions[0]!;
      this.lastSaveTime = latest.updatedAt;
      this.statusBar.setLastSave(this.lastSaveTime);
    }

    // Track the current active session
    const activeSession = sessions.find((s) => s.status === 'active');

    // On first poll, just record known IDs + active session
    if (this.isFirstPoll) {
      for (const s of sessions) {
        this.knownSessionIds.add(s.id);
      }
      this.trackedActiveSessionId = activeSession?.id ?? null;
      this.isFirstPoll = false;
      return;
    }

    // Detect external session close (e.g. dashboard "Generate Memory")
    // If we were tracking an active session and it's now closed:
    // 1. Flush any pending events (they'll go into a new session via ingest)
    // 2. Reset the buffer
    // 3. Create a new session
    if (this.trackedActiveSessionId && !activeSession) {
      console.log('[SessionWatcher] Active session closed externally — flushing pending events');
      // Flush first to avoid losing buffered commits
      if (this.gitWatcher) {
        await this.gitWatcher.flush();
      }
      this.gitWatcher?.resetBuffer();
      void this.client.createSession(this.projectId!).then((res) => {
        if (!res.error && res.data) {
          this.trackedActiveSessionId = res.data.sessionId;
          this.knownSessionIds.add(res.data.sessionId);
          void vscode.window.showInformationMessage(
            'Contox: Session closed externally — new session started.',
          );
        }
      });
    } else {
      this.trackedActiveSessionId = activeSession?.id ?? null;
    }

    // Detect new sessions
    for (const session of sessions) {
      if (!this.knownSessionIds.has(session.id)) {
        this.knownSessionIds.add(session.id);
        this.onNewSession(session);
      }
    }
  }

  /* ── New session detected ────────────────────────────────────────────── */

  private onNewSession(session: V2Session): void {
    // Parse summary if JSON
    let summaryText = 'New session saved';
    if (session.summary) {
      try {
        const parsed = JSON.parse(session.summary) as Record<string, unknown>;
        if (typeof parsed['executiveSummary'] === 'string') {
          summaryText = parsed['executiveSummary'];
        }
      } catch {
        summaryText = session.summary;
      }
    }

    // Truncate summary
    const shortSummary = summaryText.length > 120
      ? summaryText.slice(0, 117) + '...'
      : summaryText;

    const source = session.source === 'mcp-server' ? 'MCP'
      : session.source === 'cli-auto' ? 'CLI'
      : session.source ?? 'unknown';

    // Show notification with pipeline tracking option
    void vscode.window.showInformationMessage(
      `$(cloud-upload) Contox: Session saved (${source}) — ${shortSummary}`,
      'View Pipeline',
      'Dismiss',
    ).then((action) => {
      if (action === 'View Pipeline') {
        this.startPipelinePolling(session.id);
      }
    });

    // Update status bar
    this.lastSaveTime = session.updatedAt;
    this.statusBar.setLastSave(this.lastSaveTime);

    // Auto-start pipeline polling for new session
    this.startPipelinePolling(session.id);
  }

  /* ── Pipeline polling ────────────────────────────────────────────────── */

  private startPipelinePolling(sessionId: string): void {
    this.stopPipelinePolling();
    this.activeSessionId = sessionId;

    // Immediate first poll
    void this.pollPipeline();

    this.pipelineTimer = setInterval(() => {
      void this.pollPipeline();
    }, PIPELINE_POLL_INTERVAL);
  }

  private async pollPipeline(): Promise<void> {
    if (this.disposed || !this.activeSessionId) { return; }

    const result = await this.client.getSessionJobs(this.activeSessionId);
    if (result.error || !result.data) { return; }

    const { jobs, pipeline } = result.data;

    // Update status bar with pipeline info
    this.statusBar.setPipeline(pipeline);

    // Check if pipeline is terminal
    if (pipeline.status === 'done' || pipeline.status === 'failed') {
      this.stopPipelinePolling();

      // Show completion notification
      const jobDetails = jobs
        .map((j) => {
          const icon = j.status === 'done' ? '✓' : j.status === 'failed' ? '✗' : '○';
          const label = JOB_LABELS[j.jobType] ?? j.jobType;
          return `${icon} ${label}`;
        })
        .join('  ');

      if (pipeline.status === 'done') {
        void vscode.window.showInformationMessage(
          `$(check) Contox pipeline complete: ${jobDetails}`,
        );
      } else {
        const failedJob = jobs.find((j) => j.status === 'failed');
        const errorMsg = failedJob?.lastError ? ` — ${failedJob.lastError.slice(0, 80)}` : '';
        void vscode.window.showWarningMessage(
          `$(warning) Contox pipeline failed: ${jobDetails}${errorMsg}`,
        );
      }

      // Reset status bar to last save
      if (this.lastSaveTime) {
        this.statusBar.setLastSave(this.lastSaveTime);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }
}
