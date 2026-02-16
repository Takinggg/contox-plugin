/* ═══════════════════════════════════════════════════════════════════════════════
 * CLI: contox approve — Flush daemon + display context pack readiness
 *
 * Triggers an immediate daemon flush, waits for completion,
 * and displays the updated brain stats.
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';

import { createV2Config, v2GetBrain } from '../lib/v2-api.js';

const CONTOX_DIR = '.contox';
const PORT_FILE = 'daemon.port';

export const approveCommand = new Command('approve')
  .description('Flush daemon and show updated brain stats')
  .action(async () => {
    const dir = process.cwd();

    // 1. Try to flush daemon
    const portPath = join(dir, CONTOX_DIR, PORT_FILE);
    if (existsSync(portPath)) {
      try {
        const port = parseInt(readFileSync(portPath, 'utf-8').trim(), 10);
        const res = await fetch(`http://127.0.0.1:${port}/flush`, { method: 'POST' });
        const body = await res.json() as { ok: boolean };
        if (body.ok) {
          console.log(chalk.green('Daemon flushed'));
        }
      } catch {
        console.log(chalk.dim('Daemon not running, skipping flush'));
      }
    } else {
      console.log(chalk.dim('No daemon running'));
    }

    // 2. Show brain stats
    const config = createV2Config();
    if (!config) {
      console.log(chalk.dim('Not configured — run contox login && contox init'));
      return;
    }

    try {
      const brain = await v2GetBrain(config);
      console.log(chalk.green('Context pack ready'));
      console.log(`  Items:  ${brain.itemsLoaded}`);
      console.log(`  Tokens: ~${brain.tokenEstimate}`);
      console.log(`  Hash:   ${brain.brainHash}`);
    } catch (err) {
      console.log(chalk.dim(`Cannot reach API: ${String(err)}`));
    }
  });
