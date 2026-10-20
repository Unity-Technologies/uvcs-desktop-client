import { describe, expect, it } from 'vitest';
import { withoutUrlUserInfo } from './urlUserInfo';

describe('withoutUrlUserInfo', () => {
  it('drops a user and a password or token, or a token alone as the user', () => {
    expect(withoutUrlUserInfo('https://ana:ghp_s3cr3t@github.com/team/game.git')).toBe('https://github.com/team/game.git');
    expect(withoutUrlUserInfo('https://ghp_s3cr3t@github.com/team/game.git')).toBe('https://github.com/team/game.git');
  });

  it('drops a password holding an @ whole', () => {
    expect(withoutUrlUserInfo('https://ana:p@ss@git.corp/game.git')).toBe('https://git.corp/game.git');
  });

  it('puts a mark in its place when asked, in every URL of a text', () => {
    expect(withoutUrlUserInfo('from https://a:b@one.com/x to HTTP://c@two.com/y', '•••@')).toBe('from https://•••@one.com/x to HTTP://•••@two.com/y');
  });

  it('leaves a URL without user info, an SSH remote, an @ in a path and a repository spec alone', () => {
    for (const text of ['https://github.com/team/game.git', 'git@github.com:team/game.git', 'https://github.com/team/user@example.git', 'br:/main@game@cloud:8087']) {
      expect(withoutUrlUserInfo(text)).toBe(text);
    }
  });
});
