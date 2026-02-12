import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';

import type { ContoxClient, VsCodeCaptureCommit, VsCodeCaptureEvent } from '../api/client';
import type { StatusBarManager } from './status-bar';

const execFileAsync = promisify(execFile);

/* ═══════════════════════════════════════════════════════════════════════════════
 * Git Watcher — Universal capture sensor for VS Code / Cursor / Windsurf
 *
 * Watches git commits and file saves, flushes immediately on each commit
 * to the Contox V2 ingest API with skipEnrichment=true.
 * Enrichment is deferred to user action in the Dashboard Inbox.
 * ═══════════════════════════════════════════════════════════════════════════════ */

/** Flush buffer after 15 minutes of inactivity */
const IDLE_FLUSH_MS = 15 * 60 * 1000;

/** Auto-flush every 15 minutes regardless of activity */
const AUTO_FLUSH_INTERVAL_MS = 15 * 60 * 1000;

/** Volume thresholds */
const MAX_EVENTS_BEFORE_PROMPT = 50;
const MAX_PAYLOAD_SIZE_BEFORE_PROMPT = 100 * 1024; // 100KB

interface CaptureBuffer {
  commits: VsCodeCaptureCommit[];
  filesModified: Set<string>;
  activeEditorFiles: Set<string>;
  sessionStartTime: number;
  lastActivityTime: number;
  eventCount: number;
  totalPayloadSize: number;
}

export class GitWatcher implements vscode.Disposable {
  private projectId: string | null = null;
  private lastKnownHead: string | null = null;
  private buffer: CaptureBuffer | null = null;
  private disposed = false;

  // Timers
  private idleTimer: ReturnType<typeof setInterval> | undefined;
  private autoFlushTimer: ReturnType<typeof setInterval> | undefined;
  private captureTickTimer: ReturnType<typeof setInterval> | undefined;

  // Disposables for VS Code event listeners
  private gitStateDisposable: vscode.Disposable | undefined;
  private fileSaveDisposable: vscode.Disposable | undefined;

  constructor(
    private readonly client: ContoxClient,
    private readonly statusBar: StatusBarManager,
    private readonly secrets: vscode.SecretStorage,
  ) {}

  /* ── Public API ────────────────────────────────────────────────────────── */

  start(projectId: string): void {
    if (this.disposed) { return; }

    const config = vscode.workspace.getConfiguration('contox');
    if (!config.get<boolean>('capture.enabled', true)) { return; }

    this.projectId = projectId;
    this.initBuffer();
    this.watchGitState();
    this.watchFileSaves();
    this.startTimers();
  }

  /** Reset the capture buffer (e.g. after an external session close). */
  resetBuffer(): void {
    this.initBuffer();
  }

  stop(): void {
    this.clearTimers();
    this.gitStateDisposable?.dispose();
    this.gitStateDisposable = undefined;
    this.fileSaveDisposable?.dispose();
    this.fileSaveDisposable = undefined;
    this.projectId = null;
  }

  async flush(): Promise<void> {
    if (!this.buffer || !this.projectId) { return; }
    if (this.buffer.commits.length === 0 && this.buffer.filesModified.size === 0) { return; }

    const hmacSecret = await this.getHmacSecret();
    if (!hmacSecret) {
      console.warn('[GitWatcher] No HMAC secret configured — skipping flush');
      return;
    }

    const event: VsCodeCaptureEvent = {
      type: 'vscode_capture',
      commits: this.buffer.commits,
      filesModified: [...this.buffer.filesModified],
      sessionDurationMs: Date.now() - this.buffer.sessionStartTime,
      activeEditorFiles: [...this.buffer.activeEditorFiles],
    };

    const result = await this.client.ingestEvents(this.projectId, event, hmacSecret);

    if (result.error) {
      console.error('[GitWatcher] Ingest failed:', result.error);
      void vscode.window.showWarningMessage(`Contox: Failed to send captured events — ${result.error}`);
    } else {
      const commitCount = this.buffer.commits.length;
      const fileCount = this.buffer.filesModified.size;
      console.log(`[GitWatcher] Flushed: ${commitCount} commits, ${fileCount} files`);
    }

    // Reset buffer
    this.initBuffer();
  }

  getEventCount(): number {
    return this.buffer?.eventCount ?? 0;
  }

  getSessionDurationMs(): number {
    if (!this.buffer) { return 0; }
    return Date.now() - this.buffer.sessionStartTime;
  }

  /**
   * End the current session: flush pending events, close the session via API,
   * and reset the buffer so the next event starts a new session.
   */
  async endSession(): Promise<{ closed: boolean; sessionId?: string; newSessionId?: string }> {
    if (!this.projectId) { return { closed: false }; }

    // 1. Flush any pending events into the current session
    await this.flush();

    // 2. Find the active session for this project
    const result = await this.client.getActiveSession(this.projectId);
    if (result.error || !result.data) {
      return { closed: false };
    }

    // 3. Close it via API
    const closeResult = await this.client.closeSession(result.data.id);
    if (closeResult.error) {
      return { closed: false };
    }

    // 4. Reset buffer so the next event starts a fresh session
    this.initBuffer();

    // 5. Create a new session immediately
    let newSessionId: string | undefined;
    const createResult = await this.client.createSession(this.projectId, 'vscode');
    if (!createResult.error && createResult.data) {
      newSessionId = createResult.data.sessionId;
    }

    return { closed: true, sessionId: result.data.id, newSessionId };
  }

  /* ── Git extension integration ─────────────────────────────────────────── */

  private watchGitState(): void {
    this.gitStateDisposable?.dispose();

    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension) {
        console.warn('[GitWatcher] Git extension not found — falling back to polling');
        this.startGitPolling();
        return;
      }

      const git = gitExtension.isActive
        ? gitExtension.exports.getAPI(1)
        : null;

      if (!git || !git.repositories || git.repositories.length === 0) {
        console.warn('[GitWatcher] No git repositories found — falling back to polling');
        this.startGitPolling();
        return;
      }

      const repo = git.repositories[0];
      this.lastKnownHead = repo.state?.HEAD?.commit ?? null;

      // Watch for state changes (new commits, branch switches, etc.)
      this.gitStateDisposable = repo.state.onDidChange(() => {
        void this.onGitStateChanged(repo);
      });
    } catch {
      console.warn('[GitWatcher] Failed to access git extension — falling back to polling');
      this.startGitPolling();
    }
  }

  private async onGitStateChanged(repo: { state: { HEAD?: { commit?: string } } }): Promise<void> {
    if (this.disposed || !this.buffer) { return; }

    const currentHead = repo.state?.HEAD?.commit ?? null;
    if (!currentHead || currentHead === this.lastKnownHead) { return; }

    const previousHead = this.lastKnownHead;
    this.lastKnownHead = currentHead;

    // New commit detected — extract details
    if (previousHead) {
      await this.captureNewCommits(previousHead, currentHead);
    } else {
      await this.captureCommit(currentHead);
    }

    // Flush immediately after commit — ensures events are sent before VS Code closes
    console.log('[GitWatcher] Commit detected — auto-flushing');
    await this.flush();

    // Check if this was a push (remote tracking branch updated)
    void this.checkForPush();
  }

  /**
   * Detect git push by checking if local HEAD matches the remote tracking branch.
   * After a push, the remote ref matches the local ref — auto-flush as a natural checkpoint.
   */
  private async checkForPush(): Promise<void> {
    const rootPath = this.getWorkspaceRoot();
    if (!rootPath || !this.buffer || this.buffer.eventCount === 0) { return; }

    try {
      const { stdout: localRef } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: rootPath });
      const { stdout: remoteRef } = await execFileAsync('git', ['rev-parse', '@{u}'], { cwd: rootPath });

      if (localRef.trim() === remoteRef.trim()) {
        // Local matches remote — a push just happened
        console.log('[GitWatcher] Push detected — auto-flushing');
        await this.flush();
      }
    } catch {
      // No upstream configured or git error — ignore
    }
  }

  private gitPollTimer: ReturnType<typeof setInterval> | undefined;

  private startGitPolling(): void {
    // Fallback: poll git log every 15 seconds
    this.gitPollTimer = setInterval(() => {
      void this.pollGitHead();
    }, 15_000);
  }

  private async pollGitHead(): Promise<void> {
    if (this.disposed || !this.buffer) { return; }

    const rootPath = this.getWorkspaceRoot();
    if (!rootPath) { return; }

    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: rootPath });
      const currentHead = stdout.trim();

      if (this.lastKnownHead && currentHead !== this.lastKnownHead) {
        await this.captureNewCommits(this.lastKnownHead, currentHead);
        console.log('[GitWatcher] Commit detected (poll) — auto-flushing');
        await this.flush();
      }

      this.lastKnownHead = currentHead;
    } catch {
      // Git not available or not a repo — ignore
    }
  }

  /* ── Commit capture ───────────────────────────────────────────────────── */

  private async captureNewCommits(fromSha: string, toSha: string): Promise<void> {
    const rootPath = this.getWorkspaceRoot();
    if (!rootPath || !this.buffer) { return; }

    try {
      // Get commit log between fromSha and toSha
      const { stdout } = await execFileAsync('git', [
        'log', `${fromSha}..${toSha}`,
        '--format=%H|%s|%an|%aI',
        '--no-merges',
      ], { cwd: rootPath });

      const lines = stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const [sha, message, author, timestamp] = line.split('|');
        if (!sha) { continue; }
        await this.captureCommitDetails(rootPath, sha, message ?? '', author ?? '', timestamp ?? '');
      }
    } catch {
      // Fallback: just capture the tip commit
      await this.captureCommit(toSha);
    }
  }

  private async captureCommit(sha: string): Promise<void> {
    const rootPath = this.getWorkspaceRoot();
    if (!rootPath || !this.buffer) { return; }

    try {
      const { stdout } = await execFileAsync('git', [
        'log', '-1', sha, '--format=%s|%an|%aI',
      ], { cwd: rootPath });

      const [message, author, timestamp] = stdout.trim().split('|');
      await this.captureCommitDetails(rootPath, sha, message ?? '', author ?? '', timestamp ?? '');
    } catch {
      // Can't get commit info — skip
    }
  }

  private async captureCommitDetails(
    rootPath: string, sha: string, message: string, author: string, timestamp: string,
  ): Promise<void> {
    if (!this.buffer) { return; }

    let filesChanged: string[] = [];
    let insertions = 0;
    let deletions = 0;

    try {
      const { stdout } = await execFileAsync('git', [
        'diff-tree', '--no-commit-id', '-r', '--numstat', sha,
      ], { cwd: rootPath });

      for (const line of stdout.trim().split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        const ins = parseInt(parts[0] ?? '0', 10);
        const del = parseInt(parts[1] ?? '0', 10);
        const file = parts[2] ?? '';

        if (file && !this.isExcluded(file)) {
          filesChanged.push(file);
          insertions += isNaN(ins) ? 0 : ins;
          deletions += isNaN(del) ? 0 : del;
          this.buffer.filesModified.add(file);
        }
      }
    } catch {
      // Can't get diff stats — proceed without
    }

    // Apply exclude patterns to file list
    filesChanged = filesChanged.filter((f) => !this.isExcluded(f));

    const commit: VsCodeCaptureCommit = {
      sha: sha.slice(0, 12),
      message: message.slice(0, 500),
      author: author.slice(0, 200),
      timestamp,
      filesChanged,
      insertions,
      deletions,
    };

    this.buffer.commits.push(commit);
    this.buffer.eventCount += 1;
    this.buffer.totalPayloadSize += JSON.stringify(commit).length;
    this.buffer.lastActivityTime = Date.now();

    // Update status bar
    this.updateStatusBar();

    // Check volume thresholds
    this.checkVolumeThreshold();
  }

  /* ── File save tracking ────────────────────────────────────────────────── */

  private watchFileSaves(): void {
    this.fileSaveDisposable?.dispose();

    this.fileSaveDisposable = vscode.workspace.onDidSaveTextDocument((doc) => {
      if (!this.buffer || this.disposed) { return; }

      const relativePath = vscode.workspace.asRelativePath(doc.uri, false);
      if (!this.isExcluded(relativePath)) {
        const isNew = !this.buffer.filesModified.has(relativePath);
        this.buffer.filesModified.add(relativePath);
        this.buffer.lastActivityTime = Date.now();
        if (isNew) {
          this.buffer.eventCount += 1;
        }
      }
    });

    // Track active editor files
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!this.buffer || this.disposed || !editor) { return; }
      const relativePath = vscode.workspace.asRelativePath(editor.document.uri, false);
      if (!this.isExcluded(relativePath)) {
        this.buffer.activeEditorFiles.add(relativePath);
      }
    });
  }

  /* ── Timers & notifications ────────────────────────────────────────────── */

  private startTimers(): void {
    this.clearTimers();

    // Idle flush timer — check every 60s
    this.idleTimer = setInterval(() => {
      if (!this.buffer || this.buffer.eventCount === 0) { return; }
      const idle = Date.now() - this.buffer.lastActivityTime;
      if (idle > IDLE_FLUSH_MS) {
        void this.flush();
      }
    }, 60_000);

    // Auto-flush timer — flush every 15 minutes regardless of activity
    this.autoFlushTimer = setInterval(() => {
      if (!this.buffer || this.buffer.eventCount === 0) { return; }
      console.log(`[GitWatcher] Auto-flush: ${this.buffer.eventCount} events, ${this.buffer.commits.length} commits`);
      void this.flush();
    }, AUTO_FLUSH_INTERVAL_MS);

    // Status bar tick — every 1 second for live timer
    this.captureTickTimer = setInterval(() => {
      this.updateStatusBar();
    }, 1_000);
  }

  private clearTimers(): void {
    if (this.idleTimer) { clearInterval(this.idleTimer); this.idleTimer = undefined; }
    if (this.autoFlushTimer) { clearInterval(this.autoFlushTimer); this.autoFlushTimer = undefined; }
    if (this.captureTickTimer) { clearInterval(this.captureTickTimer); this.captureTickTimer = undefined; }
    if (this.gitPollTimer) { clearInterval(this.gitPollTimer); this.gitPollTimer = undefined; }
  }

  private checkVolumeThreshold(): void {
    if (!this.buffer) { return; }

    if (
      this.buffer.eventCount >= MAX_EVENTS_BEFORE_PROMPT ||
      this.buffer.totalPayloadSize >= MAX_PAYLOAD_SIZE_BEFORE_PROMPT
    ) {
      console.log(`[GitWatcher] Volume threshold reached (${this.buffer.eventCount} events) — auto-flushing`);
      void this.flush();
    }
  }

  /* ── Helpers ───────────────────────────────────────────────────────────── */

  private initBuffer(): void {
    this.buffer = {
      commits: [],
      filesModified: new Set(),
      activeEditorFiles: new Set(),
      sessionStartTime: Date.now(),
      lastActivityTime: Date.now(),
      eventCount: 0,
      totalPayloadSize: 0,
    };
  }

  private updateStatusBar(): void {
    if (!this.buffer || this.buffer.eventCount === 0) { return; }

    const durationSecs = Math.floor(this.getSessionDurationMs() / 1000);
    this.statusBar.setCapturing(durationSecs, this.buffer.eventCount);
  }

  private getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) { return null; }
    return folders[0]!.uri.fsPath;
  }

  private isExcluded(filePath: string): boolean {
    const config = vscode.workspace.getConfiguration('contox');
    const patterns = config.get<string[]>('capture.excludePatterns', [
      '*.env', '*.key', '*.pem', '*.p12', '*.pfx',
      'node_modules/**', '.git/**', 'dist/**',
    ]);

    const lower = filePath.toLowerCase();
    for (const pattern of patterns) {
      // Simple glob matching: *.ext and dir/**
      if (pattern.startsWith('*')) {
        if (lower.endsWith(pattern.slice(1))) { return true; }
      } else if (pattern.endsWith('/**')) {
        const dir = pattern.slice(0, -3);
        if (lower.startsWith(dir + '/') || lower.startsWith(dir + '\\')) { return true; }
      } else if (lower === pattern.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  private hmacSecretWarningShown = false;

  private async getHmacSecret(): Promise<string | null> {
    // 1. Try VS Code SecretStorage first
    const fromSecrets = await this.secrets.get('contox-hmac-secret');
    if (fromSecrets) { return fromSecrets; }

    // 2. Try settings fallback
    const config = vscode.workspace.getConfiguration('contox');
    const fromSettings = config.get<string>('hmacSecret', '');
    if (fromSettings) { return fromSettings; }

    // 3. API fallback — fetch from server and cache in SecretStorage
    if (this.projectId) {
      try {
        const result = await this.client.getProjectHmacSecret(this.projectId);
        if (result.data?.hmacSecret) {
          await this.secrets.store('contox-hmac-secret', result.data.hmacSecret);
          console.log('[GitWatcher] HMAC secret fetched from API and cached');
          return result.data.hmacSecret;
        }
      } catch {
        // API call failed — continue to warning
      }
    }

    // 4. Show user-facing warning (once per session)
    if (!this.hmacSecretWarningShown) {
      this.hmacSecretWarningShown = true;
      void vscode.window.showWarningMessage(
        'Contox: Capture events cannot be sent — HMAC secret missing. Re-run "Contox: Setup" to fix.',
        'Open Setup',
      ).then((action) => {
        if (action === 'Open Setup') {
          void vscode.commands.executeCommand('contox.setup');
        }
      });
    }

    return null;
  }

  /* ── Cleanup ───────────────────────────────────────────────────────────── */

  dispose(): void {
    this.disposed = true;
    // Flush remaining events on deactivation
    void this.flush();
    this.stop();
  }
}
