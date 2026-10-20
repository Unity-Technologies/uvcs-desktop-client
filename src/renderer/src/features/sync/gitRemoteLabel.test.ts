import { describe, expect, it } from 'vitest';
import { gitRemoteLabel } from './gitRemoteLabel';

describe('gitRemoteLabel', () => {
  it('names a Git remote without the credentials its URL carries (the rule: withoutUrlUserInfo)', () => {
    expect(gitRemoteLabel('https://ana:ghp_s3cr3t@github.com/team/game.git')).toBe('https://github.com/team/game.git');
  });
});
