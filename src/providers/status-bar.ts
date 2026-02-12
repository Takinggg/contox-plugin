import * as vscode from 'vscode';
import type { V2PipelineSummary } from '../api/client';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Status Bar Manager — Enhanced with last save time + pipeline status
 * ═══════════════════════════════════════════════════════════════════════════════ */

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

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private lastSaveIso: string | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = 'contox.sync';
    this.setIdle();
    this.item.show();

    // Refresh "Xm ago" display every 30s
    this.refreshTimer = setInterval(() => {
      if (this.lastSaveIso) {
        this.setLastSave(this.lastSaveIso);
      }
    }, 30_000);
  }

  setIdle(): void {
    this.item.text = '$(cloud) Contox';
    this.item.tooltip = 'Click to sync contexts';
    this.item.backgroundColor = undefined;
  }

  setSyncing(): void {
    this.item.text = '$(sync~spin) Contox: Syncing...';
    this.item.tooltip = 'Syncing contexts...';
    this.item.backgroundColor = undefined;
  }

  setSynced(): void {
    this.item.text = '$(cloud) Contox: Synced';
    this.item.tooltip = 'Contexts synced — click to refresh';
    this.item.backgroundColor = undefined;
  }

  setError(): void {
    this.item.text = '$(error) Contox: Error';
    this.item.tooltip = 'Sync failed — click to retry';
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  /**
   * Show last save time in the status bar.
   */
  setLastSave(iso: string): void {
    this.lastSaveIso = iso;
    const ago = formatTimeAgo(iso);
    this.item.text = `$(cloud) Contox: saved ${ago}`;
    this.item.tooltip = `Last save: ${new Date(iso).toLocaleString()}\nClick to sync`;
    this.item.backgroundColor = undefined;
  }

  /**
   * Show active pipeline status.
   */
  setPipeline(pipeline: V2PipelineSummary): void {
    const { completedSteps, totalSteps, status } = pipeline;

    switch (status) {
      case 'running':
        this.item.text = `$(sync~spin) Contox: pipeline ${completedSteps}/${totalSteps}`;
        this.item.tooltip = `Pipeline running — ${completedSteps}/${totalSteps} steps complete`;
        this.item.backgroundColor = undefined;
        break;
      case 'done':
        this.item.text = `$(check) Contox: pipeline done`;
        this.item.tooltip = `Pipeline complete — ${totalSteps} steps`;
        this.item.backgroundColor = undefined;
        break;
      case 'failed':
        this.item.text = `$(error) Contox: pipeline failed`;
        this.item.tooltip = `Pipeline failed — ${completedSteps}/${totalSteps} steps completed`;
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      default:
        this.item.text = `$(clock) Contox: pipeline pending`;
        this.item.tooltip = 'Pipeline pending...';
        this.item.backgroundColor = undefined;
    }
  }

  /**
   * Show active capture session with live timer and event count.
   * Clicking the status bar triggers a manual flush.
   */
  setCapturing(durationSecs: number, eventCount: number): void {
    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    const time = mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
    this.item.text = `$(record) Contox: ${time} \u00B7 ${eventCount} events`;
    this.item.tooltip = `Capturing work activity\n${eventCount} events buffered\nClick to send now`;
    this.item.command = 'contox.flushCapture';
    this.item.backgroundColor = undefined;
  }

  dispose(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.item.dispose();
  }
}
