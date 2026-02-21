import chalk from 'chalk';
import { getGlobalConfig } from './config.js';

export interface ApiError {
  error: string;
}

export interface ContextItem {
  id: string;
  name: string;
  description: string | null;
  content?: string | null;
  status: string;
  files: number;
  tokens: number;
  lastSynced: string;
  projectId: string | null;
  parentContextId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  teamId: string;
  contextsCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a pre-configured fetch wrapper that adds auth headers.
 * Returns null and prints error if not logged in.
 */
export function createApiClient(): {
  get: (path: string) => Promise<Response>;
  post: (path: string, body: unknown) => Promise<Response>;
  patch: (path: string, body: unknown) => Promise<Response>;
  baseUrl: string;
} | null {
  const config = getGlobalConfig();
  if (!config) {
    console.log(chalk.red('✗'), 'Not logged in. Run', chalk.cyan('contox login -k <api-key>'));
    return null;
  }

  const baseUrl = config.apiUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  return {
    baseUrl,
    get: (path: string) => fetch(`${baseUrl}${path}`, { headers }),
    post: (path: string, body: unknown) =>
      fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }),
    patch: (path: string, body: unknown) =>
      fetch(`${baseUrl}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) }),
  };
}

export async function handleApiError(res: Response, label: string): Promise<void> {
  try {
    const data = (await res.json()) as ApiError;
    console.log(chalk.red('✗'), `${label}:`, data.error ?? `HTTP ${String(res.status)}`);
  } catch {
    console.log(chalk.red('✗'), `${label}: HTTP ${String(res.status)}`);
  }
}

/**
 * Pre-flight access check — verifies the API key can access the given project.
 * Returns true if access is granted, false (with error message) if not.
 */
export async function verifyProjectAccess(
  api: { get: (path: string) => Promise<Response> },
  projectId: string,
): Promise<boolean> {
  try {
    const res = await api.get(`/api/v2/projects/${encodeURIComponent(projectId)}`);
    if (res.status === 401 || res.status === 403) {
      console.log(chalk.red('✗'), 'Access denied: your API key does not have permission to access this project.');
      return false;
    }
    if (res.status === 404) {
      console.log(chalk.red('✗'), `Project not found: ${projectId}`);
      return false;
    }
    return res.ok;
  } catch {
    // Network error — allow the main command to handle it
    return true;
  }
}
