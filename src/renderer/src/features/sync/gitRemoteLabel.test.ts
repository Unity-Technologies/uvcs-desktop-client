import { describe, expect, it } from 'vitest';
import { gitRemoteLabel } from './gitRemoteLabel';

describe('gitRemoteLabel', () => {
  it('drops a user and a password or token from the URL', () => {
    expect(gitRemoteLabel('https://ana:ghp_s3cr3t@github.com/team/game.git')).toBe('https://github.com/team/game.git');
    expect(gitRemoteLabel('HTTP://ana:p%40ss@git.corp:8080/game.git')).toBe('HTTP://git.corp:8080/game.git');
  });

  it('drops a token passed as the user alone', () => {
    expect(gitRemoteLabel('https://ghp_s3cr3t@github.com/team/game.git')).toBe('https://github.com/team/game.git');
  });

  it('keeps a URL without credentials, and an SSH remote, as typed', () => {
    expect(gitRemoteLabel('https://github.com/team/game.git')).toBe('https://github.com/team/game.git');
    expect(gitRemoteLabel('git@github.com:team/game.git')).toBe('git@github.com:team/game.git');
    expect(gitRemoteLabel('https://github.com/team/user@example.git')).toBe('https://github.com/team/user@example.git');
  });
});
