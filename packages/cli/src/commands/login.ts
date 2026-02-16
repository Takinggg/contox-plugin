import { Command } from 'commander';
import chalk from 'chalk';
import { saveGlobalConfig, getGlobalConfigPath } from '../lib/config.js';

export const loginCommand = new Command('login')
  .description('Store your Contox API key')
  .requiredOption('-k, --key <apiKey>', 'Your Contox API key')
  .option('--url <apiUrl>', 'API URL', 'https://contox.dev')
  .action((opts: { key: string; url: string }) => {
    saveGlobalConfig({
      apiKey: opts.key,
      apiUrl: opts.url,
    });

    console.log(chalk.green('✓'), 'API key saved to', chalk.dim(getGlobalConfigPath()));
    console.log(chalk.dim('  Run'), chalk.cyan('contox whoami'), chalk.dim('to verify your credentials.'));
  });
