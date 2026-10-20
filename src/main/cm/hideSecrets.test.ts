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

  it("hides a URL's user and password, keeping the host", () => {
    expect(commandLineForLog(['sync', 'r', 'git', 'https://ana:ghp_123@github.com/team/game.git'])).toBe('cm sync r git https://•••@github.com/team/game.git');
  });

  it("hides a token passed as the URL's user alone, as GitHub takes it", () => {
    expect(commandLineForLog(['sync', 'r', 'git', 'https://ghp_s3cr3t@github.com/team/game.git'])).toBe('cm sync r git https://•••@github.com/team/game.git');
  });

  it('leaves an SSH remote, an @ in a path and a repository spec alone', () => {
    const args = ['sync', 'r', 'git', 'git@github.com:team/game.git', 'https://github.com/team/user@example.git', 'br:/main@game@cloud:8087'];
    expect(commandLineForLog(args)).toBe(`cm ${args.join(' ')}`);
  });
});

describe('outputForLog', () => {
  it('leaves the error a sync to an unreachable Git server prints as it is: it names the address, not the URL', () => {
    const printed = 'Error: An error occurred while connecting to Git: Connection refused [::ffff:127.0.0.1]:9 (127.0.0.1:9)';
    expect(outputForLog(printed)).toBe(printed);
  });

  it('hides a token the output echoes back', () => {
    expect(outputForLog('Error: could not reach https://ana:ghp_123@github.com/game.git\r\nretry')).toBe('Error: could not reach https://•••@github.com/game.git\r\nretry');
    expect(outputForLog("fatal: Authentication failed for 'https://ghp_s3cr3t@github.com/team/game.git/'")).toBe(
      "fatal: Authentication failed for 'https://•••@github.com/team/game.git/'",
    );
  });
});

describe('textForLog', () => {
  it('hides the secrets of a command line an error quotes, and a token in a URL', () => {
    const text = 'Error: cm sync r git https://ana:ghp_123@example.com/game --user=ana --pwd=s3cret failed\n    at run (index.js:1:2)';
    expect(textForLog(text)).toBe('Error: cm sync r git https://•••@example.com/game --user=ana --pwd=••• failed\n    at run (index.js:1:2)');
  });
});
