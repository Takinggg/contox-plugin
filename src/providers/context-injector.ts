import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import type { ContoxClient, SearchResult } from '../api/client';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Context Injector — Auto-inject relevant memory into .contox/context.md
 *
 * Watches active editor changes and debounces file-context queries.
 * When a file is opened/focused, searches the project memory for relevant
 * items and writes a focused context file that AI tools can reference.
 *
 * The injected file is at .contox/context.md — a lightweight, focused subset
 * of the brain relevant to the current working file. This supplements the
 * full .contox/memory.md with file-specific context.
 *
 * Rate limiting:
 *   - Debounce: 2s after editor change
 *   - Cache: Same file path → reuse results for 5 minutes
 *   - Minimum interval: 10s between API calls
 * ═══════════════════════════════════════════════════════════════════════════════ */

const DEBOUNCE_MS = 2000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_INTERVAL_MS = 10 * 1000;   // 10s between API calls
const MAX_RESULTS = 8;

interface CacheEntry {
  filePath: string;
  results: SearchResult[];
  timestamp: number;
}

export class ContextInjector implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private cache: CacheEntry | null = null;
  private lastApiCall = 0;
  private projectId: string | null = null;
  private rootPath: string | null = null;
  private enabled = true;

  constructor(private readonly client: ContoxClient) {
    // Watch active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && this.enabled && this.projectId) {
          this.scheduleInjection(editor.document);
        }
      }),
    );
  }

  /** Start watching for a specific project */
  start(projectId: string): void {
    this.projectId = projectId;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      this.rootPath = workspaceFolders[0]!.uri.fsPath;
    }

    // Inject for currently active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      this.scheduleInjection(activeEditor.document);
    }
  }

  /** Stop watching */
  stop(): void {
    this.projectId = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Toggle enabled state */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  private scheduleInjection(document: vscode.TextDocument): void {
    // Skip non-file URIs (output panels, untitled, etc.)
    if (document.uri.scheme !== 'file') { return; }

    // Skip known non-code files
    const ext = path.extname(document.fileName).toLowerCase();
    const skipExts = new Set(['.md', '.json', '.lock', '.txt', '.log', '.env', '.csv', '.svg', '.png', '.jpg', '.gif']);
    if (skipExts.has(ext)) { return; }

    // Skip files in .contox directory
    if (document.fileName.includes('.contox')) { return; }

    // Debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.injectForFile(document.fileName);
    }, DEBOUNCE_MS);
  }

  private async injectForFile(filePath: string): Promise<void> {
    if (!this.projectId || !this.rootPath) { return; }

    // Check cache
    if (this.cache && this.cache.filePath === filePath) {
      const age = Date.now() - this.cache.timestamp;
      if (age < CACHE_TTL_MS) {
        return; // Already have fresh context for this file
      }
    }

    // Rate limit
    const now = Date.now();
    if (now - this.lastApiCall < MIN_INTERVAL_MS) {
      return;
    }

    // Build search query from file path
    const relativePath = path.relative(this.rootPath, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath, path.extname(filePath));
    const dirName = path.dirname(relativePath);

    // Create a semantic query from the file context
    const query = `${fileName} ${dirName.replace(/\//g, ' ')}`.trim();

    try {
      this.lastApiCall = Date.now();
      // Pass activeFiles for composite scoring (file overlap boost)
      const result = await this.client.searchMemory(this.projectId, query, MAX_RESULTS, [relativePath]);

      if (result.error || !result.data) { return; }

      const results = result.data.results;
      if (results.length === 0) { return; }

      // Cache the results
      this.cache = { filePath, results, timestamp: Date.now() };

      // Write context file
      this.writeContextFile(relativePath, results);
    } catch {
      // Non-critical — don't interrupt user workflow
    }
  }

  private writeContextFile(currentFile: string, results: SearchResult[]): void {
    if (!this.rootPath) { return; }

    const contoxDir = path.join(this.rootPath, '.contox');
    if (!fs.existsSync(contoxDir)) {
      fs.mkdirSync(contoxDir, { recursive: true });
    }

    const lines: string[] = [
      '# Active Context',
      '',
      `> Auto-generated for: \`${currentFile}\``,
      `> ${String(results.length)} relevant memory items found`,
      '',
    ];

    for (const item of results) {
      const sim = Math.round(item.similarity * 100);
      lines.push(`## ${item.title}`);
      lines.push(`> ${item.type} | ${sim}% match | ${item.schemaKey}`);
      if (item.files.length > 0) {
        lines.push(`> Files: ${item.files.slice(0, 3).join(', ')}`);
      }
      lines.push('');
      // Truncate facts to keep context file small
      const truncatedFacts = item.facts.length > 500
        ? item.facts.slice(0, 500) + '...'
        : item.facts;
      lines.push(truncatedFacts);
      lines.push('');
    }

    lines.push('---');
    lines.push(`_Updated: ${new Date().toLocaleTimeString()} | Full memory: .contox/memory.md_`);

    const contextPath = path.join(contoxDir, 'context.md');
    fs.writeFileSync(contextPath, lines.join('\n'), 'utf-8');
  }

  dispose(): void {
    this.stop();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
