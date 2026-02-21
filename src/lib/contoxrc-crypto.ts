import { writeFileSync, readFileSync, existsSync, chmodSync } from 'fs';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { join } from 'path';
import { homedir, hostname, userInfo } from 'os';

/* ═══════════════════════════════════════════════════════════════════════════════
 * Encrypted ~/.contoxrc writer for the VS Code extension.
 *
 * Mirrors the encryption scheme in packages/cli/src/lib/config.ts so both
 * the CLI and the extension can read/write the same file interchangeably.
 *
 * Sensitive fields (apiKey, hmacSecret) are encrypted with AES-256-GCM
 * using a machine-derived key (hostname + username + homedir).
 * ═══════════════════════════════════════════════════════════════════════════════ */

const CONTOXRC_PATH = join(homedir(), '.contoxrc');
const ENC_PREFIX = 'enc:';

/* ── Encryption helpers ──────────────────────────────────────────────────── */

function deriveKey(): Buffer {
    // Machine-specific key — must match CLI's deriveKey() exactly
    const material = `contox:${hostname()}:${userInfo().username}:${homedir()}`;
    return createHash('sha256').update(material).digest();
}

function encrypt(plaintext: string): string {
    const key = deriveKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: enc:<iv>:<tag>:<ciphertext> (all base64) — same as CLI
    return `${ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/* ── Public API ──────────────────────────────────────────────────────────── */

export interface ContoxRcConfig {
    apiKey: string;
    apiUrl: string;
    teamId?: string;
    projectId?: string;
    hmacSecret?: string;
}

/**
 * Write ~/.contoxrc with sensitive fields encrypted (AES-256-GCM).
 * Non-sensitive fields (apiUrl, teamId, projectId) are stored in plaintext.
 * File permissions are set to 0o600 (owner-only) where supported.
 */
export function writeContoxRc(config: ContoxRcConfig): void {
    // Preserve any existing fields we don't explicitly set
    let existing: Record<string, string> = {};
    try {
        if (existsSync(CONTOXRC_PATH)) {
            existing = JSON.parse(readFileSync(CONTOXRC_PATH, 'utf-8')) as Record<string, string>;
        }
    } catch {
        // Corrupted file — overwrite entirely
    }

    const stored: Record<string, string> = {
        ...existing,
        apiKey: encrypt(config.apiKey),
        apiUrl: config.apiUrl,
    };

    if (config.teamId) { stored['teamId'] = config.teamId; }
    if (config.projectId) { stored['projectId'] = config.projectId; }
    if (config.hmacSecret) { stored['hmacSecret'] = encrypt(config.hmacSecret); }

    writeFileSync(CONTOXRC_PATH, JSON.stringify(stored, null, 2) + '\n', {
        encoding: 'utf-8',
        mode: 0o600,
    });

    try { chmodSync(CONTOXRC_PATH, 0o600); } catch { /* Windows may not support chmod */ }
}
