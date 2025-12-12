import { execFile } from 'node:child_process';
import * as util from 'node:util';
import { GitError, SddErrorCode } from '@sdd-bundle-editor/shared-types';

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
    throw new GitError(
      'AI operations require a Git repository.',
      SddErrorCode.GIT_NOT_REPO,
      { path: cwd }
    );
  }

  if (!status.branch) {
    throw new GitError(
      'Unable to determine current Git branch.',
      SddErrorCode.GIT_NOT_REPO,
      { path: cwd }
    );
  }

  if (DEFAULT_PROTECTED_BRANCHES.has(status.branch)) {
    throw new GitError(
      `AI operations must run on a non-protected branch (current: "${status.branch}").`,
      SddErrorCode.GIT_NOT_CLEAN,
      { branch: status.branch, suggestion: 'Switch to a feature branch before making changes' }
    );
  }

  if (!status.isClean) {
    throw new GitError(
      'Working tree must be clean before running AI operations.',
      SddErrorCode.GIT_NOT_CLEAN,
      { suggestion: 'Commit or stash your changes before proceeding' }
    );
  }
}

export async function commitChanges(cwd: string, message: string, files: string[] = []): Promise<string> {
  if (files.length === 0) {
    throw new GitError(
      'No files specified for commit.',
      SddErrorCode.GIT_COMMIT_FAILED,
      { cwd, message }
    );
  }

  try {
    // First, stage the files with 'git add'
    // This is required for new (untracked) files, and also works for modified tracked files
    await execFileAsync('git', ['add', '--', ...files], { cwd });

    // Then commit with the message
    const { stdout } = await execFileAsync('git', ['commit', '-m', message], { cwd });
    return stdout.trim();
  } catch (err) {
    throw new GitError(
      `Git commit failed: ${err instanceof Error ? err.message : String(err)}`,
      SddErrorCode.GIT_COMMIT_FAILED,
      { cwd, message, files, originalError: err instanceof Error ? err.message : String(err) }
    );
  }
}
