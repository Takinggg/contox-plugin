import { Command } from 'commander';
import chalk from 'chalk';
import { createApiClient, handleApiError } from '../lib/api.js';
import { getGlobalConfig, getGlobalConfigPath } from '../lib/config.js';

interface ContextsResponse {
  id: string;
  name: string;
}

export const whoamiCommand = new Command('whoami')
  .description('Verify your API key and show connection info')
  .action(async () => {
    const api = createApiClient();
    if (!api) return;

    const config = getGlobalConfig();

    console.log(chalk.bold('\n  Contox CLI\n'));
    console.log(`  Config:  ${chalk.dim(getGlobalConfigPath())}`);
    console.log(`  API URL: ${chalk.cyan(config?.apiUrl ?? '(not set)')}`);
    console.log(`  API Key: ${chalk.dim(config?.apiKey.slice(0, 8) + '...' + config?.apiKey.slice(-4))}`);

    try {
      // Try a simple API call to verify the key works
      const res = await api.get('/api/contexts?limit=1');

      if (!res.ok) {
        console.log(`\n  ${chalk.red('✗')} API key is ${chalk.red('invalid')} or expired.`);
        await handleApiError(res, 'Auth check');
        return;
      }

      const data = (await res.json()) as ContextsResponse[];
      console.log(`\n  ${chalk.green('✓')} Authenticated — ${String(data.length >= 1 ? 'contexts found' : 'no contexts yet')}`);
    } catch (err) {
      console.log(`\n  ${chalk.red('✗')} Cannot reach API:`, (err as Error).message);
    }

    console.log('');
  });
