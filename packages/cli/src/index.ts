#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { loadBundleWithSchemaValidation } from '@sdd-bundle-editor/core-model';

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
     
    console.log(JSON.stringify(out, null, 2));
  } else {
    for (const d of diagnostics) {
      const locationParts = [];
      if (d.filePath) locationParts.push(d.filePath);
      if (d.entityType && d.entityId) locationParts.push(`${d.entityType}(${d.entityId})`);
      if (d.path) locationParts.push(d.path);
      const location = locationParts.length ? ` [${locationParts.join(' ')}]` : '';
       
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
     
    console.log(JSON.stringify(coverageStats, null, 2));
  } else {
    for (const [key, stat] of Object.entries(coverageStats)) {
      const s = stat as {
        totalTargets: number;
        coveredTargets: number;
      };
      const pct =
        s.totalTargets > 0 ? Math.round((s.coveredTargets / s.totalTargets) * 100) : 0;
       
      console.log(
        `${key}: ${s.coveredTargets}/${s.totalTargets} targets covered (${pct}%)`,
      );
    }
  }

  return 0;
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
         
        console.error((err as Error).message);
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}

if (require.main === module) {
   
  main(process.argv);
}
