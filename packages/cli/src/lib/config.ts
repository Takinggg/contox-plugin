import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/* ═══════════════════════════════════════════════════════════════════════════════
 * GLOBAL CONFIG (~/.contoxrc)
 * Stores API key and API URL.
 * ═══════════════════════════════════════════════════════════════════════════════ */

const GLOBAL_CONFIG_FILE = join(homedir(), '.contoxrc');

export interface GlobalConfig {
  apiKey: string;
  apiUrl: string;
  hmacSecret?: string;
}

export function getGlobalConfig(): GlobalConfig | null {
  // Environment variables take priority (used by VS Code extension terminal)
  const envKey = process.env['CONTOX_API_KEY'];
  if (envKey) {
    return {
      apiKey: envKey,
      apiUrl: process.env['CONTOX_API_URL'] ?? 'https://contox.dev',
    };
  }

  if (!existsSync(GLOBAL_CONFIG_FILE)) {
    return null;
  }
  try {
    const raw = readFileSync(GLOBAL_CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as GlobalConfig;
  } catch {
    return null;
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE;
}

/* ═══════════════════════════════════════════════════════════════════════════════
 * PROJECT CONFIG (.contox.json in project root)
 * Stores teamId and projectId for the current project directory.
 * ═══════════════════════════════════════════════════════════════════════════════ */

const PROJECT_CONFIG_FILE = '.contox.json';

export interface ProjectConfig {
  teamId: string;
  projectId: string;
  projectName?: string;
}

export function findProjectConfig(startDir: string = process.cwd()): ProjectConfig | null {
  let dir = startDir;
  // Walk up looking for .contox.json
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

export function saveProjectConfig(dir: string, config: ProjectConfig): void {
  const filePath = join(dir, PROJECT_CONFIG_FILE);
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}
