/* ═══════════════════════════════════════════════════════════════════════════════
 * Project Resolver — Auto-detect project from cwd
 *
 * Resolution order:
 * 1. .contox.json in cwd (walk up 20 levels)
 * 2. Git repo name → lookup/auto-create project via API
 * 3. CONTOX_PROJECT_ID env var (backwards compat)
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, basename } from 'node:path';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface ProjectConfig {
  teamId: string;
  projectId: string;
  projectName?: string;
}

export interface ResolveInput {
  apiKey?: string;
  apiUrl?: string;
  teamId?: string;
  projectId?: string;
}

export interface ResolvedConfig {
  apiKey: string;
  apiUrl: string;
  teamId: string;
  projectId: string;
}

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  teamId: string;
  contextsCount: number;
  createdAt: string;
  updatedAt: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const PROJECT_CONFIG_FILE = '.contox.json';
const EXEC_TIMEOUT = 5_000;

// ── .contox.json discovery ──────────────────────────────────────────────────

export function findProjectConfig(startDir: string = process.cwd()): ProjectConfig | null {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    const candidate = join(dir, PROJECT_CONFIG_FILE);
    if (existsSync(candidate)) {
      try {
        const raw = readFileSync(candidate, 'utf-8');
        return JSON.parse(raw) as ProjectConfig;
      } catch {
        return null;
      }
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── Git helpers ─────────────────────────────────────────────────────────────

function getGitRepoRoot(cwd: string): string | null {
  try {
    return execSync('git rev-parse --show-toplevel', {
      cwd,
      encoding: 'utf-8',
      timeout: EXEC_TIMEOUT,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function getGitRepoName(cwd: string): string | null {
  const root = getGitRepoRoot(cwd);
  if (!root) return null;
  return basename(root);
}

// ── API helpers (standalone, no client needed) ──────────────────────────────

async function listProjectsByName(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  name: string,
): Promise<ProjectItem[]> {
  const params = new URLSearchParams({ teamId, name });
  const response = await fetch(`${apiUrl}/api/projects?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) return [];
  return response.json() as Promise<ProjectItem[]>;
}

async function createProject(
  apiKey: string,
  apiUrl: string,
  teamId: string,
  name: string,
): Promise<ProjectItem> {
  const response = await fetch(`${apiUrl}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ name, teamId }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    const message = typeof body['error'] === 'string' ? body['error'] : response.statusText;
    throw new Error(`Failed to create project "${name}": ${message}`);
  }
  return response.json() as Promise<ProjectItem>;
}

function writeProjectConfig(dir: string, config: ProjectConfig): void {
  try {
    const filePath = join(dir, PROJECT_CONFIG_FILE);
    writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  } catch {
    // Non-fatal: config write failure shouldn't block resolution
  }
}

// ── Main resolver ───────────────────────────────────────────────────────────

export async function resolveProject(input: ResolveInput): Promise<ResolvedConfig> {
  const apiKey = input.apiKey ?? '';
  const apiUrl = (input.apiUrl ?? 'https://contox.dev').replace(/\/$/, '');
  const teamId = input.teamId ?? '';

  if (!apiKey) {
    throw new Error('CONTOX_API_KEY is required. Set it as an environment variable.');
  }
  if (!teamId) {
    throw new Error('CONTOX_TEAM_ID is required. Set it as an environment variable.');
  }

  // 1. Try .contox.json from cwd
  const cwd = process.cwd();
  const fileConfig = findProjectConfig(cwd);
  if (fileConfig?.projectId) {
    return {
      apiKey,
      apiUrl,
      teamId: fileConfig.teamId || teamId,
      projectId: fileConfig.projectId,
    };
  }

  // 2. Try git repo name → lookup/auto-create
  const repoName = getGitRepoName(cwd);
  if (repoName) {
    try {
      const existing = await listProjectsByName(apiKey, apiUrl, teamId, repoName);
      if (existing.length > 0) {
        const project = existing[0]!;
        // Write .contox.json for next time
        const repoRoot = getGitRepoRoot(cwd) ?? cwd;
        writeProjectConfig(repoRoot, {
          teamId,
          projectId: project.id,
          projectName: project.name,
        });
        return { apiKey, apiUrl, teamId, projectId: project.id };
      }

      // Auto-create project from repo name
      const created = await createProject(apiKey, apiUrl, teamId, repoName);
      const repoRoot = getGitRepoRoot(cwd) ?? cwd;
      writeProjectConfig(repoRoot, {
        teamId,
        projectId: created.id,
        projectName: created.name,
      });
      return { apiKey, apiUrl, teamId, projectId: created.id };
    } catch {
      // Fall through to env var fallback
    }
  }

  // 3. Fallback to CONTOX_PROJECT_ID env var
  if (input.projectId) {
    return { apiKey, apiUrl, teamId, projectId: input.projectId };
  }

  throw new Error(
    'Could not resolve project. Either:\n' +
    '  - Add a .contox.json file (run `contox init`)\n' +
    '  - Set CONTOX_PROJECT_ID environment variable\n' +
    '  - Run from a git repository directory',
  );
}
