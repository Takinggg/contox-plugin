import { Command } from 'commander';

import { pushCommand } from './commands/push.js';
import { pullCommand } from './commands/pull.js';
import { statusCommand } from './commands/status.js';
import { loginCommand } from './commands/login.js';
import { initCommand } from './commands/init.js';
import { whoamiCommand } from './commands/whoami.js';
import { scanCommand } from './commands/scan.js';
import { memoryCommand } from './commands/memory.js';
import { saveCommand } from './commands/save.js';
import { oncallCommand } from './commands/oncall.js';
import { explainCommand } from './commands/explain.js';
import { daemonCommand } from './commands/daemon.js';
import { contextCommand } from './commands/context-pack.js';
import { approveCommand } from './commands/approve.js';
import { collectCommand } from './commands/collect.js';
import { exportCommand } from './commands/export.js';
import { hygieneCommand } from './commands/hygiene.js';

const program = new Command();

program
  .name('contox')
  .description('Contox CLI — manage AI contexts from the terminal')
  .version('1.0.1');

// Auth
program.addCommand(loginCommand);
program.addCommand(whoamiCommand);
program.addCommand(initCommand);

// Memory (the core feature)
program.addCommand(memoryCommand);
program.addCommand(saveCommand);

// Context management
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(scanCommand);
program.addCommand(statusCommand);

// DevEx (operational)
program.addCommand(oncallCommand);
program.addCommand(explainCommand);

// V2 daemon + context
program.addCommand(daemonCommand);
program.addCommand(contextCommand);
program.addCommand(approveCommand);
program.addCommand(collectCommand);
program.addCommand(exportCommand);

// Hygiene
program.addCommand(hygieneCommand);

program.parse();
