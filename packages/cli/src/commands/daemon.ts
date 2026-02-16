/* ═══════════════════════════════════════════════════════════════════════════════
 * CLI: contox daemon — Manage the Contox background daemon
 *
 * Subcommands:
 *   contox daemon start   → Start the daemon in background
 *   contox daemon stop    → Stop the running daemon
 *   contox daemon status  → Show daemon stats
 *   contox daemon flush   → Trigger immediate flush
 * ═══════════════════════════════════════════════════════════════════════════════ */

import { Command } from 'commander';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';

const CONTOX_DIR = '.contox';
const PID_FILE = 'daemon.pid';
const PORT_FILE = 'daemon.port';
const STATS_FILE = 'daemon-stats.json';

interface DaemonStatus {
  pid: number;
  port: number;
  startedAt: string;
  stats: {
    buffered: number;
    totalFlushed: number;
    lastFlushAt: string | null;
    uptime: number;
  };
}

function readPid(dir: string): number | null {
  const p = join(dir, CONTOX_DIR, PID_FILE);
  if (!existsSync(p)) return null;
  try {
    const pid = parseInt(readFileSync(p, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch { return null; }
}

function readPort(dir: string): number | null {
  const p = join(dir, CONTOX_DIR, PORT_FILE);
  if (!existsSync(p)) return null;
  try {
    const port = parseInt(readFileSync(p, 'utf-8').trim(), 10);
    return isNaN(port) ? null : port;
  } catch { return null; }
}

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export const daemonCommand = new Command('daemon')
  .description('Manage the Contox background daemon');

daemonCommand
  .command('start')
  .description('Start the daemon in background')
  .action(() => {
    const dir = process.cwd();
    const pid = readPid(dir);
    if (pid && isRunning(pid)) {
      console.log(chalk.yellow(`Daemon already running (PID ${pid})`));
      return;
    }

    // Try to find contox-daemon binary
    const daemonBin = join(dir, 'packages', 'daemon', 'dist', 'index.js');
    if (!existsSync(daemonBin)) {
      console.log(chalk.red('Daemon not built. Run: cd packages/daemon && npm run build'));
      process.exit(1);
    }

    const child = spawn(process.execPath, [daemonBin, 'run'], {
      cwd: dir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    });

    child.unref();
    console.log(chalk.green(`Daemon started (PID ${child.pid})`));
  });

daemonCommand
  .command('stop')
  .description('Stop the running daemon')
  .action(() => {
    const dir = process.cwd();
    const pid = readPid(dir);

    if (!pid) {
      console.log('No daemon running');
      return;
    }

    if (!isRunning(pid)) {
      console.log(chalk.dim(`PID ${pid} not running, cleaning up`));
      try { unlinkSync(join(dir, CONTOX_DIR, PID_FILE)); } catch { /* */ }
      try { unlinkSync(join(dir, CONTOX_DIR, PORT_FILE)); } catch { /* */ }
      return;
    }

    try {
      process.kill(pid, 'SIGTERM');
      console.log(chalk.green(`Daemon stopped (PID ${pid})`));
    } catch (err) {
      console.error(chalk.red(`Failed: ${String(err)}`));
    }
  });

daemonCommand
  .command('status')
  .description('Show daemon stats')
  .action(() => {
    const dir = process.cwd();
    const pid = readPid(dir);

    if (!pid || !isRunning(pid)) {
      console.log(chalk.dim('Daemon is not running'));
      return;
    }

    const statsPath = join(dir, CONTOX_DIR, STATS_FILE);
    if (existsSync(statsPath)) {
      try {
        const s = JSON.parse(readFileSync(statsPath, 'utf-8')) as DaemonStatus;
        console.log(chalk.green(`Daemon running`) + chalk.dim(` (PID ${s.pid}, port ${s.port})`));
        console.log(`  Started:  ${s.startedAt}`);
        console.log(`  Buffered: ${s.stats.buffered} events`);
        console.log(`  Flushed:  ${s.stats.totalFlushed} total`);
        console.log(`  Last:     ${s.stats.lastFlushAt ?? 'never'}`);
        console.log(`  Uptime:   ${Math.round(s.stats.uptime / 1000)}s`);
        return;
      } catch { /* fall through */ }
    }

    console.log(chalk.green(`Daemon running`) + chalk.dim(` (PID ${pid})`));
  });

daemonCommand
  .command('flush')
  .description('Trigger immediate flush')
  .action(async () => {
    const dir = process.cwd();
    const port = readPort(dir);

    if (!port) {
      console.log(chalk.red('Daemon not running'));
      process.exit(1);
    }

    try {
      const res = await fetch(`http://127.0.0.1:${port}/flush`, { method: 'POST' });
      const body = await res.json() as { ok: boolean; error?: string };

      if (body.ok) {
        console.log(chalk.green('Flush triggered'));
      } else {
        console.error(chalk.red(`Flush failed: ${body.error ?? 'unknown'}`));
        process.exit(1);
      }
    } catch (err) {
      console.error(chalk.red(`Cannot reach daemon: ${String(err)}`));
      process.exit(1);
    }
  });
