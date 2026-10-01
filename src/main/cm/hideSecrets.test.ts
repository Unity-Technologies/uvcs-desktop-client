import { describe, expect, it } from 'vitest';
import { commandLineForLog, outputForLog, textForLog } from './hideSecrets';

describe('commandLineForLog', () => {
  it('shows a command without secrets as it ran', () => {
    expect(commandLineForLog(['find', 'branch', 'where', 'name', '=', "'main'"])).toBe("cm find branch where name = 'main'");
  });

  it('hides the password of a Git sync, keeping the user', () => {
    const args = ['sync', 'game@local', 'git', 'https://github.com/team/game.git', '--user=ana', '--pwd=s3cr:t@x y'];
    expect(commandLineForLog(args)).toBe('cm sync game@local git https://github.com/team/game.git --user=ana --pwd=•••');
  });

  it('hides an empty password too, so its length never shows', () => {
    expect(commandLineForLog(['sync', 'r', 'git', 'u', '--pwd='])).toBe('cm sync r git u --pwd=•••');
  });

  it('hides a token in a URL, keeping the host and the user', () => {
    expect(commandLineForLog(['sync', 'r', 'git', 'https://ana:ghp_123@github.com/team/game.git'])).toBe(
      'cm sync r git https://ana:•••@github.com/team/game.git',
    );
  });

  it('leaves a URL with only a user, or a repository spec, alone', () => {
    expect(commandLineForLog(['sync', 'r', 'git', 'https://ana@github.com/game.git', 'br:/main@game@cloud:8087'])).toBe(
      'cm sync r git https://ana@github.com/game.git br:/main@game@cloud:8087',
    );
  });
});

describe('outputForLog', () => {
  it('hides a token the output echoes back', () => {
    expect(outputForLog('Error: could not reach https://ana:ghp_123@github.com/game.git\r\nretry')).toBe(
      'Error: could not reach https://ana:•••@github.com/game.git\r\nretry',
    );
  });
});

describe('textForLog', () => {
  it('hides the secrets of a command line an error quotes, and a token in a URL', () => {
    const text = 'Error: cm sync r git https://ana:ghp_123@example.com/game --user=ana --pwd=s3cret failed\n    at run (index.js:1:2)';
    expect(textForLog(text)).toBe('Error: cm sync r git https://ana:•••@example.com/game --user=ana --pwd=••• failed\n    at run (index.js:1:2)');
  });
});
