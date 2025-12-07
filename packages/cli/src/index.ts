#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as readline from 'node:readline';
import { loadBundleWithSchemaValidation } from '@sdd-bundle-editor/core-model';
import {
  buildBundleSchemaSnapshot,
  buildBundleSnapshot,
  createNoopProvider,
  createAgentBackend,
  generateBundle as aiGenerateBundle,
} from '@sdd-bundle-editor/core-ai';
import { assertCleanNonMainBranch } from '@sdd-bundle-editor/git-utils';

interface DiagnosticOutput {
  severity: 'error' | 'warning';
  message: string;
  entityType?: string;
  entityId?: string;
  filePath?: string;
  path?: string;
  source?: 'schema' | 'lint' | 'gate';
  code?: string;
}

async function findBundleDir(explicitDir?: string): Promise<string> {
  const dir = explicitDir ? path.resolve(explicitDir) : process.cwd();
  const manifestPath = path.join(dir, 'sdd-bundle.yaml');
  try {
    await fs.access(manifestPath);
    return dir;
  } catch {
    throw new Error(`sdd-bundle.yaml not found in ${dir}`);
  }
}

async function runValidate(options: { bundleDir?: string; output?: string }): Promise<number> {
  const bundleDir = await findBundleDir(options.bundleDir);
  const { diagnostics } = await loadBundleWithSchemaValidation(bundleDir);

  const hasErrors = diagnostics.some((d) => d.severity === 'error');

  if (options.output === 'json') {
    const out: DiagnosticOutput[] = diagnostics.map((d) => ({
      severity: d.severity,
      message: d.message,
      entityType: d.entityType,
      entityId: d.entityId,
      filePath: d.filePath,
      path: d.path,
      source: d.source,
      code: d.code,
    }));
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(out, null, 2));
  } else {
    for (const d of diagnostics) {
      const locationParts = [];
      if (d.filePath) locationParts.push(d.filePath);
      if (d.entityType && d.entityId) locationParts.push(`${d.entityType}(${d.entityId})`);
      if (d.path) locationParts.push(d.path);
      const location = locationParts.length ? ` [${locationParts.join(' ')}]` : '';
      // eslint-disable-next-line no-console
      console.log(`${d.severity.toUpperCase()}: ${d.message}${location}`);
    }
  }

  return hasErrors ? 1 : 0;
}

async function runReportCoverage(options: { bundleDir?: string; output?: string }): Promise<number> {
  const bundleDir = await findBundleDir(options.bundleDir);
  const { bundle } = await loadBundleWithSchemaValidation(bundleDir);

  const coverageStats: Record<string, unknown> = {};

  if (bundle.bundleTypeDefinition?.relations) {
    for (const relation of bundle.bundleTypeDefinition.relations) {
      const key = `${relation.fromEntity}->${relation.toEntity}:${relation.fromField}`;
      const totalTargets =
        bundle.entities.get(relation.toEntity)?.size ?? 0;
      const coveredTargets = new Set(
        bundle.refGraph.edges
          .filter(
            (e) =>
              e.fromEntityType === relation.fromEntity &&
              e.fromField === relation.fromField &&
              e.toEntityType === relation.toEntity,
          )
          .map((e) => e.toId),
      ).size;
      coverageStats[key] = {
        relation: relation.name,
        fromEntity: relation.fromEntity,
        toEntity: relation.toEntity,
        viaField: relation.fromField,
        totalTargets,
        coveredTargets,
      };
    }
  }

  if (options.output === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(coverageStats, null, 2));
  } else {
    for (const [key, stat] of Object.entries(coverageStats)) {
      const s = stat as {
        totalTargets: number;
        coveredTargets: number;
      };
      const pct =
        s.totalTargets > 0 ? Math.round((s.coveredTargets / s.totalTargets) * 100) : 0;
      // eslint-disable-next-line no-console
      console.log(
        `${key}: ${s.coveredTargets}/${s.totalTargets} targets covered (${pct}%)`,
      );
    }
  }

  return 0;
}

async function runGenerate(options: {
  bundleDir?: string;
  bundleType?: string;
  domainPath?: string;
  providerId?: string;
}): Promise<number> {
  const bundleDir = await findBundleDir(options.bundleDir);
  await assertCleanNonMainBranch(bundleDir);
  const { bundle, diagnostics } = await loadBundleWithSchemaValidation(bundleDir);
  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  if (hasErrors) {
    throw new Error('Bundle has validation errors; cannot run AI generate.');
  }

  const domainPath =
    options.domainPath ??
    (bundle.manifest as any).spec?.domainKnowledge?.path ??
    'domain/domain-knowledge.md';

  let domainMarkdown = '';
  try {
    const domainFullPath = path.join(bundleDir, domainPath);
    domainMarkdown = await fs.readFile(domainFullPath, 'utf8');
  } catch {
    // ignore; domainMarkdown stays empty
  }

  const provider = createNoopProvider({ id: options.providerId ?? 'noop-cli' });

  const requestBase = {
    bundleType: options.bundleType ?? bundle.manifest.metadata.bundleType,
    schema: buildBundleSchemaSnapshot(bundle),
    bundle: buildBundleSnapshot(bundle),
    domainMarkdown,
    diagnostics,
    instructions: undefined,
  };

  const response = await aiGenerateBundle(provider, requestBase);

  // eslint-disable-next-line no-console
  console.log(
    'AI generate (noop provider) completed. Notes:',
    (response.notes ?? []).join('\n'),
  );

  // In the MVP stub, we do not write any YAML; just exit successfully if no exception.
  return 0;
}

async function runChat(options: {
  bundleDir?: string;
  backend?: 'cli' | 'http';
  cmd?: string;
  args?: string[];
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<void> {
  const bundleDir = await findBundleDir(options.bundleDir);
  console.log(`Starting chat in ${bundleDir}...`);

  const config = {
    type: options.backend || 'cli',
    options: {
      command: options.cmd,
      args: options.args,
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
      model: options.model
    }
  } as any;

  const backend = createAgentBackend(config);
  await backend.initialize(config);

  // Initialize conversation
  await backend.startConversation({ bundleDir });
  console.log(`Backend (${config.type}) initialized. Type your message and press Enter. (Ctrl+C to exit)`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'User> '
  });

  rl.prompt();

  for await (const line of rl) {
    if (!line.trim()) {
      rl.prompt();
      continue;
    }

    try {
      // Show loading indicator?
      const state = await backend.sendMessage(line);

      if (state.status === 'error') {
        console.error(`Agent Error: ${state.lastError}`);
      } else {
        const lastMsg = state.messages[state.messages.length - 1];
        if (lastMsg && lastMsg.role === 'agent') {
          console.log(`Agent> ${lastMsg.content}`);
        }
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
    }

    rl.prompt();
  }
}

export async function main(argv: string[]): Promise<void> {
  const program = new Command();
  program.name('sdd-bundle').description('SDD bundle CLI').version('0.0.0');

  program
    .command('validate')
    .description('Validate an SDD bundle')
    .option('--bundle-dir <dir>', 'Bundle directory (default: current working directory)')
    .option('--output <format>', 'Output format (json or text)', 'text')
    .action(async (opts) => {
      try {
        const exitCode = await runValidate(opts);
        process.exitCode = exitCode;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error((err as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('report-coverage')
    .description('Report relation coverage for an SDD bundle')
    .option('--bundle-dir <dir>', 'Bundle directory (default: current working directory)')
    .option('--output <format>', 'Output format (json or text)', 'text')
    .action(async (opts) => {
      try {
        const exitCode = await runReportCoverage(opts);
        process.exitCode = exitCode;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error((err as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('generate')
    .description('Run AI-assisted bundle generation (stubbed)')
    .option('--bundle-dir <dir>', 'Bundle directory (default: current working directory)')
    .option('--bundle-type <type>', 'Bundle type id (e.g. sdd-core)')
    .option('--domain <path>', 'Path to domain knowledge markdown')
    .option('--provider <id>', 'AI provider id (for future use)')
    .action(async (opts) => {
      try {
        const exitCode = await runGenerate({
          bundleDir: opts.bundleDir,
          bundleType: opts.bundleType,
          domainPath: opts.domain,
          providerId: opts.provider,
        });
        process.exitCode = exitCode;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error((err as Error).message);
        process.exitCode = 1;
      }
    });

  program
    .command('chat')
    .description('Start interactive chat with an agent backend')
    .option('--bundle-dir <dir>', 'Bundle directory (default: current working directory)')
    .option('--backend <type>', 'Backend type (cli, http)', 'cli')
    .option('--cmd <command>', 'Command to run for CLI backend', 'codex')
    .option('--args <args...>', 'Arguments for CLI backend')
    .option('--api-key <key>', 'API Key for HTTP backend')
    .option('--base-url <url>', 'Base URL for HTTP backend')
    .option('--model <model>', 'Model for HTTP backend')
    .action(async (opts) => {
      try {
        await runChat(opts);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error((err as Error).message);
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main(process.argv);
}
