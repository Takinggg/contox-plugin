import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { homedir, hostname, userInfo } from 'node:os';

/* ═══════════════════════════════════════════════════════════════════════════════
 * GLOBAL CONFIG (~/.contoxrc)
 * Stores API key and API URL. Sensitive fields are encrypted at rest
 * using AES-256-GCM with a machine-derived key.
 * ═══════════════════════════════════════════════════════════════════════════════ */

const GLOBAL_CONFIG_FILE = join(homedir(), '.contoxrc');

export interface GlobalConfig {
  apiKey: string;
  apiUrl: string;
  hmacSecret?: string;
}

/* ── Encryption helpers ──────────────────────────────────────────────────── */

const ENC_PREFIX = 'enc:';

function deriveKey(): Buffer {
  // Machine-specific key: protects against file copy to another machine
  const material = `contox:${hostname()}:${userInfo().username}:${homedir()}`;
  return createHash('sha256').update(material).digest();
}

function encrypt(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: enc:<iv>:<tag>:<ciphertext> (all base64)
  return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(encoded: string): string | null {
  if (!encoded.startsWith(ENC_PREFIX)) { return null; }
  try {
    const parts = encoded.slice(ENC_PREFIX.length).split(':');
    if (parts.length !== 3) { return null; }
    const [ivB64, tagB64, dataB64] = parts as [string, string, string];
    const key = deriveKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return decipher.update(Buffer.from(dataB64, 'base64')) + decipher.final('utf8');
  } catch {
    return null;
  }
}

/** Decrypt a field, falling back to plaintext for backward compat. */
function readField(value: string | undefined): string | undefined {
  if (!value) { return undefined; }
  if (value.startsWith(ENC_PREFIX)) {
    return decrypt(value) ?? undefined;
  }
  // Plaintext (legacy) — still works, will be encrypted on next save
  return value;
}

/* ── Config I/O ──────────────────────────────────────────────────────────── */

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
    const stored = JSON.parse(raw) as Record<string, string | undefined>;
    const apiKey = readField(stored['apiKey']);
    if (!apiKey) { return null; }
    return {
      apiKey,
      apiUrl: stored['apiUrl'] ?? 'https://contox.dev',
      hmacSecret: readField(stored['hmacSecret']),
    };
  } catch {
    return null;
  }
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const stored: Record<string, string> = {
    apiKey: encrypt(config.apiKey),
    apiUrl: config.apiUrl,
  };
  if (config.hmacSecret) {
    stored['hmacSecret'] = encrypt(config.hmacSecret);
  }
  writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(stored, null, 2) + '\n', 'utf-8');
  try { chmodSync(GLOBAL_CONFIG_FILE, 0o600); } catch { /* Windows may not support chmod */ }
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
