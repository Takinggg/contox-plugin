import * as vscode from 'vscode';
import type { ContoxClient, BrainTreeNode } from '../api/client';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Tree item representing a single V2 brain node (schemaKey group)
 * ═══════════════════════════════════════════════════════════════════════════════ */

const SCHEMA_ICONS: Record<string, string> = {
  'root/decisions': 'lightbulb',
  'root/conventions': 'list-ordered',
  'root/architecture': 'server',
  'root/journal': 'notebook',
  'root/bugs': 'bug',
  'root/todo': 'checklist',
  'root/codemap': 'file-code',
  'root/stack': 'layers',
  'root/frontend': 'browser',
  'root/backend': 'server-process',
};

function nodeIcon(node: BrainTreeNode): vscode.ThemeIcon {
  const icon = SCHEMA_ICONS[node.schemaKey];
  if (icon) { return new vscode.ThemeIcon(icon); }
  if (node.children.length > 0) { return new vscode.ThemeIcon('symbol-namespace'); }
  return new vscode.ThemeIcon('symbol-field');
}

export class ContextItem extends vscode.TreeItem {
  public readonly node: BrainTreeNode;

  constructor(node: BrainTreeNode) {
    const collapsible = node.children.length > 0
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    super(node.name, collapsible);
    this.node = node;

    this.tooltip = `${node.schemaKey}\n${node.itemCount} memory items`;
    this.description = node.itemCount > 0 ? `${node.itemCount} items` : '';
    this.iconPath = nodeIcon(node);
    this.contextValue = 'contoxContext';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * Tree data provider for the Contox sidebar panel
 * ═══════════════════════════════════════════════════════════════════════════════ */

export class ContextTreeProvider implements vscode.TreeDataProvider<ContextItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ContextItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private rootNodes: BrainTreeNode[] = [];
  private total = 0;

  constructor(private readonly _client: ContoxClient) {
    // _client is available for future features (e.g. inline content preview)
  }

  setTree(tree: BrainTreeNode[], total: number): void {
    this.rootNodes = tree;
    this.total = total;
    this._onDidChangeTreeData.fire();
  }

  getTotal(): number {
    return this.total;
  }

  getTreeItem(element: ContextItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ContextItem): ContextItem[] {
    if (!element) {
      return this.rootNodes.map((n) => new ContextItem(n));
    }
    return element.node.children.map((n) => new ContextItem(n));
  }
}
