import { describe, expect, it } from 'vitest';
import { cmOutputKind, textOutputKind } from './commandOutputs';

describe('cmOutputKind', () => {
  it.each([
    [['find', 'branch', "where name = 'main'"], 'list'],
    [['ls', '/', '-R'], 'list'],
    [['diff', 'cs:12'], 'list'],
    [['annotate', 'a.cs'], 'list'],
    [['listusers', 'local', '--onlyusers'], 'list'],
    [['history', 'a.cs', '--xml'], 'list'],
    [['lock', 'list'], 'list'],
    [['profile', 'list'], 'list'],
    [['repository', 'list'], 'list'],
    [['workspace', 'list'], 'list'],
    [['changelist'], 'list'],
  ])('reads %j as a list, which grows with what it lists', (args, kind) => {
    expect(cmOutputKind(args)).toBe(kind);
  });

  it('reads the pending changes of a status as a list, and its header alone as an answer', () => {
    expect(cmOutputKind(['status', '--machinereadable'])).toBe('list');
    expect(cmOutputKind(['status', '--header', '--xml'])).toBe('answer');
  });

  it("reads an xlink's own details as an answer, and creating or editing one as an operation", () => {
    expect(cmOutputKind(['xlink', '--show', '/ws/lib'])).toBe('answer');
    expect(cmOutputKind(['xlink', '-s', '/ws/lib'])).toBe('answer');
    expect(cmOutputKind(['xlink', '-w', '/ws/lib', '/', 'cs:4@lib@local'])).toBe('operation');
    expect(cmOutputKind(['xlink', '--addrules', '/ws/lib', 'br:/main-br:/main/dev'])).toBe('operation');
  });

  it("reads a merge's machine-readable preview as a list, and a merge as an operation", () => {
    expect(cmOutputKind(['merge', 'br:/main/task', '--machinereadable', '--printcontributors'])).toBe('list');
    expect(cmOutputKind(['merge', 'br:/main/task', '--merge', '--machinereadable'])).toBe('operation');
    expect(cmOutputKind(['merge', 'br:/main/task'])).toBe('operation');
  });

  it.each([['whoami'], ['version'], ['fileinfo', 'a.cs', '--xml'], ['getworkspacefrompath', '/wk'], ['wi', '/wk'], ['showacl', 'rep:game'], ['showowner', 'rep:game'], ['checkconnection']])(
    'reads %j as an answer',
    (...args) => {
      expect(cmOutputKind(args)).toBe('answer');
    },
  );

  it.each([
    ['undo', '-r', '/wk'],
    ['add', '-R', 'Assets'],
    ['checkin', 'a.cs'],
    ['update'],
    ['switch', 'br:/main'],
    ['cat', 'rev:3', '--file=/tmp/a'],
    ['shelveset', 'create', 'a.cs'],
    ['lock', 'unlock', 'a.cs'],
    ['profile', 'delete', '--name=x'],
    ['repository', 'rename', 'rep:a', 'b'],
    ['workspace', 'delete', '/wk'],
    ['changelist', 'create', 'Art'],
  ])('reads %j as an operation', (...args) => {
    expect(cmOutputKind(args)).toBe('operation');
  });

  it('knows no command no one classified', () => {
    expect(cmOutputKind(['purge', 'register'])).toBeUndefined();
    expect(cmOutputKind([])).toBeUndefined();
  });
});

describe('textOutputKind', () => {
  it('lets an answer and an operation be read as text', () => {
    expect(textOutputKind(['whoami'])).toBe('answer');
    expect(textOutputKind(['undo', 'a.cs'])).toBe('operation');
  });

  it('refuses a list, naming the command and how to read it', () => {
    expect(() => textOutputKind(['find', 'changeset', 'where branch = 5'])).toThrow('cm find changeset prints a list: read it as it arrives (queryRecords), never as one string.');
  });

  it('refuses a command no one classified', () => {
    expect(() => textOutputKind(['purge', 'register'])).toThrow("cm purge register isn't in COMMAND_OUTPUTS (commandOutputs.ts): say how its output is read.");
  });
});
