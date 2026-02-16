import { Command } from 'commander';
import chalk from 'chalk';
import { createApiClient, handleApiError } from '../lib/api.js';
import type { ProjectItem } from '../lib/api.js';
import { saveProjectConfig } from '../lib/config.js';
import { updateClaudeMd } from '../lib/claude-md.js';

export const initCommand = new Command('init')
  .description('Initialize Contox for this project directory')
  .requiredOption('-t, --team <teamId>', 'Your team/organization ID')
  .option('-p, --project <projectId>', 'Project ID (if you already have one)')
  .option('-n, --name <name>', 'Create a new project with this name')
  .action(async (opts: { team: string; project?: string; name?: string }) => {
    const api = createApiClient();
    if (!api) return;

    let projectId = opts.project;
    let projectName: string | undefined;

    // Create a new project if --name is provided
    if (opts.name && !projectId) {
      try {
        const res = await api.post('/api/projects', {
          name: opts.name,
          teamId: opts.team,
        });

        if (!res.ok) {
          await handleApiError(res, 'Failed to create project');
          return;
        }

        const project = (await res.json()) as ProjectItem;
        projectId = project.id;
        projectName = project.name;
        console.log(chalk.green('✓'), `Created project ${chalk.bold(project.name)}`, chalk.dim(`(${project.id})`));
      } catch (err) {
        console.log(chalk.red('✗'), 'Failed to create project:', (err as Error).message);
        return;
      }
    }

    // List existing projects if no project specified
    if (!projectId) {
      try {
        const res = await api.get(`/api/projects?teamId=${opts.team}`);
        if (!res.ok) {
          await handleApiError(res, 'Failed to list projects');
          return;
        }

        const projects = (await res.json()) as ProjectItem[];

        if (projects.length === 0) {
          console.log(chalk.yellow('No projects found.'), 'Create one with', chalk.cyan('contox init -t <team> -n "My Project"'));
          return;
        }

        console.log(chalk.bold('\n  Available projects:\n'));
        for (const p of projects) {
          console.log(`  ${chalk.cyan(p.id)}  ${p.name}  ${chalk.dim(`(${String(p.contextsCount)} contexts)`)}`);
        }
        console.log(chalk.dim('\n  Run: contox init -t <team> -p <projectId>\n'));
        return;
      } catch (err) {
        console.log(chalk.red('✗'), 'Failed to list projects:', (err as Error).message);
        return;
      }
    }

    // Save project config
    saveProjectConfig(process.cwd(), {
      teamId: opts.team,
      projectId,
      projectName,
    });

    console.log(chalk.green('✓'), 'Project initialized — saved', chalk.dim('.contox.json'));
    console.log(chalk.dim('  You can now use'), chalk.cyan('contox push'), chalk.dim('and'), chalk.cyan('contox pull'));

    // Auto-generate CLAUDE.md with Contox section
    await updateClaudeMd(process.cwd(), api, opts.team, projectId);
  });
