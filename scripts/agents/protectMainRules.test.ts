import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mainBranchViolation, splitCommandLine } from './protectMainRules.mjs';

const REPOSITORY = resolve('repo');
const WORKTREE = join(REPOSITORY, '.claude', 'worktrees', 'agent-1');

/** A repository with main checked out, and a worktree on a feature branch. */
function branchIn(dir: string): string | null {
  if (dir === REPOSITORY) return 'main';
  if (dir === WORKTREE) return 'feature/x';
  return null;
}

const violation = (command: string, cwd = REPOSITORY) => mainBranchViolation(command, cwd, branchIn);

describe('protectMainRules', () => {
  describe('on main', () => {
    it.each([
      'git merge feature/x',
      'git merge --no-ff feature/x -m "Merge feature/x"',
      'git commit -m "A fix"',
      'git rebase origin/main',
      'git cherry-pick abc123',
      'git revert abc123',
      'git am < fix.patch',
    ])('refuses %s', (command) => {
      expect(violation(command)).not.toBeNull();
    });

    it('lets an agent back out of a merge it started', () => {
      expect(violation('git merge --abort')).toBeNull();
      expect(violation('git rebase --abort')).toBeNull();
    });

    it('lets main be read and brought up to date', () => {
      expect(violation('git status && git log --oneline -5 && git pull --ff-only')).toBeNull();
      expect(violation('git pull --ff-only origin main')).toBeNull();
      expect(violation('git fetch origin && git merge --ff-only origin/main')).toBeNull();
    });

    // A pull is a fetch and a merge: one that may merge, or brings in another branch, is a local merge into main.
    it.each([
      'git pull',
      'git pull --no-rebase',
      'git pull origin feature/x',
      'git pull --ff-only origin feature/x',
      'git merge --ff-only feature/x',
    ])('refuses %s', (command) => {
      expect(violation(command)).not.toBeNull();
    });
  });

  it('lets every write through on a feature branch', () => {
    expect(violation('git commit -m "A fix" && git merge origin/main', WORKTREE)).toBeNull();
  });

  it('follows cd and git -C to the checkout the command writes to', () => {
    expect(violation(`cd "${WORKTREE}" && git commit -m "A fix"`)).toBeNull();
    expect(violation(`git -C "${WORKTREE}" commit -m "A fix"`)).toBeNull();
    expect(violation(`cd "${REPOSITORY}" && git merge feature/x`, WORKTREE)).not.toBeNull();
    expect(violation(`git -C "${REPOSITORY}" merge feature/x`, WORKTREE)).not.toBeNull();
  });

  it('follows a switch to main earlier in the same command line', () => {
    expect(violation('git checkout main && git merge feature/x', WORKTREE)).not.toBeNull();
    expect(violation('git switch main; git commit -m "A fix"', WORKTREE)).not.toBeNull();
  });

  it('follows a switch away from main earlier in the same command line', () => {
    expect(violation('git switch -c fix/palette && git commit -m "A fix"')).toBeNull();
    expect(violation('git checkout -b fix/palette && git commit -m "A fix"')).toBeNull();
  });

  it('does not take a file restored with checkout for a branch', () => {
    expect(violation('git checkout -- src/a.ts && git commit -m "A fix"')).not.toBeNull();
  });

  describe('pushing', () => {
    it.each([
      'git push origin main',
      'git push origin HEAD:main',
      'git push origin feature/x:refs/heads/main',
      'git push --force origin +main',
      'git push origin --delete main',
      'git push --all origin',
    ])('refuses %s from anywhere', (command) => {
      expect(violation(command, WORKTREE)).not.toBeNull();
    });

    it('refuses a push of the current branch when it is main', () => {
      expect(violation('git push')).not.toBeNull();
      expect(violation('git push origin HEAD')).not.toBeNull();
    });

    it('lets a feature branch be pushed for its pull request', () => {
      expect(violation('git push -u origin feature/x', WORKTREE)).toBeNull();
      expect(violation('git push -u origin HEAD', WORKTREE)).toBeNull();
      expect(violation('git push origin feature/x')).toBeNull();
    });
  });

  it('ignores git words inside a quoted message', () => {
    expect(violation('gh pr create --body "Run git merge main; then git push origin main"', WORKTREE)).toBeNull();
    expect(violation('echo "git commit -m x"')).toBeNull();
  });

  // How agents commit: a heredoc message, on stdin or through "$(cat ...)". Its lines are text, not commands.
  it('ignores git words inside a heredoc message', () => {
    const plainMessage = ['Title', '', 'git push origin main is refused now', 'EOF'].join('\n');
    const quotingMessage = ['Don\'t "git merge main";', 'git push origin main is refused now', 'EOF'].join('\n');
    for (const message of [plainMessage, quotingMessage]) {
      expect(violation(`git commit -F - <<'EOF'\n${message}\ngit log --oneline -1`, WORKTREE)).toBeNull();
      expect(violation(`git commit -F - <<EOF\n${message}`, WORKTREE)).toBeNull();
      expect(violation(`git commit -m "$(cat <<'EOF'\n${message}\n)"`, WORKTREE)).toBeNull();
    }
  });

  // Claude Code's own commit form: the heredoc sits inside double quotes, and the message may hold a lone `"`.
  it('ignores a heredoc message inside "$(cat ...)" whatever quotes it holds', () => {
    const message = ['The guard refuses "a pull', 'git push origin main for sure', 'EOF'].join('\n');
    expect(violation(`git commit -m "$(cat <<'EOF'\n${message}\n)"`, WORKTREE)).toBeNull();
    const thenPush = `git commit -m "$(cat <<'EOF'\n${message}\n)"\ngit push origin main`;
    expect(violation(thenPush, WORKTREE)).not.toBeNull();
  });

  it('ignores a heredoc whose delimiter is escaped', () => {
    expect(violation(`git commit -F - <<\\EOF\nTitle\ngit push origin main\nEOF`, WORKTREE)).toBeNull();
  });

  it('does not take a here-string for a heredoc', () => {
    expect(violation(`cat <<< "EOF"\ngit merge feature/x`)).not.toBeNull();
  });

  it('reads the commands after a heredoc', () => {
    expect(violation(`git commit -F - <<'EOF' --quiet\nTitle\nEOF\ngit push origin main`, WORKTREE)).not.toBeNull();
  });

  it('reads environment assignments before git', () => {
    expect(violation('GIT_EDITOR=true git merge feature/x')).not.toBeNull();
  });

  it('lets through a checkout it cannot identify', () => {
    expect(mainBranchViolation('git commit -m "A fix"', REPOSITORY, () => null)).toBeNull();
  });

  it('splits a command line on its unquoted separators only', () => {
    expect(splitCommandLine('a && b || c; d | e\nf "g && h"')).toEqual(['a', 'b', 'c', 'd', 'e', 'f "g && h"']);
  });
});
