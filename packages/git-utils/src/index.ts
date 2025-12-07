import { execFile } from 'node:child_process';
import * as util from 'node:util';

const execFileAsync = util.promisify(execFile);

export interface GitStatus {
  isRepo: boolean;
  branch?: string;
  isClean?: boolean;
}

export async function getGitStatus(cwd: string): Promise<GitStatus> {
  try {
    const { stdout: insideOut } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
    });
    const isRepo = insideOut.toString().trim() === 'true';
    if (!isRepo) {
      return { isRepo: false };
    }

    const { stdout: branchOut } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd,
    });
    const branch = branchOut.toString().trim() || undefined;

    const { stdout: statusOut } = await execFileAsync('git', ['status', '--porcelain'], {
      cwd,
    });
    const isClean = statusOut.toString().trim().length === 0;

    return { isRepo: true, branch, isClean };
  } catch {
    return { isRepo: false };
  }
}

const DEFAULT_PROTECTED_BRANCHES = new Set(['main', 'master']);

export async function assertCleanNonMainBranch(cwd: string): Promise<void> {
  const status = await getGitStatus(cwd);
  if (!status.isRepo) {
    throw new Error('AI operations require a Git repository.');
  }

  if (!status.branch) {
    throw new Error('Unable to determine current Git branch.');
  }

  if (DEFAULT_PROTECTED_BRANCHES.has(status.branch)) {
    throw new Error(
      `AI operations must run on a non-protected branch (current: "${status.branch}").`,
    );
  }

  if (!status.isClean) {
    throw new Error('Working tree must be clean before running AI operations.');
  }
}

export async function commitChanges(cwd: string, message: string, files: string[] = []): Promise<string> {
  const args = ['commit', '-m', message];
  if (files.length > 0) {
    // If files are specified, we explicitly add them to the commit (partial commit)
    // Or we can just 'git add' them first.
    // Safety: only commit what was changed.
    // 'git commit ... files' works.
    args.push(...files);
  } else {
    // If no files specified, maybe commit all? Or throw?
    // Let's safe-guard: assume we must be explicit or use -a if intentional.
    // For this use case, we wrote files to disk, so we should commit them.
    // git commit -a is risky if we didn't track them.
    // Better to explicitly 'git add' then 'git commit'.
    // Or 'git commit file1 file2'
    throw new Error('No files specified for commit.');
  }

  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

