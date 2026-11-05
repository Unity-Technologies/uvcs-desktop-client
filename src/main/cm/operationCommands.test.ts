import { describe, expect, it } from 'vitest';
import { isOperation } from './operationCommands';

describe('isOperation', () => {
  it.each([
    ['a checkin', ['checkin', '/wk/a.cs', '-commentsfile=/t/c.txt']],
    ['an undo', ['undo', '/wk/a.cs']],
    ['an update', ['update']],
    ['a switch', ['switch', 'br:/main/task']],
    ['a merge', ['merge', 'br:/main/task', '--merge']],
    ['a shelve', ['shelveset', 'create', '--all', '-commentsfile=/t/c.txt']],
    ['a shelve applied', ['shelveset', 'apply', 'sh:3']],
    ['a sync', ['sync', 'game@local', 'git', 'https://example.com/game.git']],
    ['a push', ['push', 'br:/main@game@local', 'game@cloud']],
    ['a pull', ['pull', 'br:/main@game@cloud', 'game@local']],
  ])('counts %s as an operation', (_kind, args) => {
    expect(isOperation(args)).toBe(true);
  });

  it.each([
    ['a status', ['status', '--xml']],
    ['a merge preview', ['merge', 'br:/main/task', '--machinereadable']],
    ['a shelve list', ['shelveset', 'list']],
    ['a file read', ['cat', 'revid:3', '--file=/t/a']],
    ['a version check', ['version']],
    ['a connection check', ['checkconnection', 'local:8087']],
    ['no command', []],
  ])('does not count %s as one', (_kind, args) => {
    expect(isOperation(args)).toBe(false);
  });
});
