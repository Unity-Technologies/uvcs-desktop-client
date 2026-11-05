import { describe, expect, it } from 'vitest';
import { checkinArgs } from './checkinArgs';
import { fitsCommandLine } from './commandLineLimit';
import { processCommand } from './processCommand';
import { toShellCommandLine } from './shellCommandLine';
import { TREE_ITEM_FORMAT } from './treeItems';

const manyPaths = Array.from({ length: 20_000 }, (_, index) => `/Users/ana/work/My Project/Assets/Textures/Level ${index % 40}/texture_${index}.png`);

describe('processCommand', () => {
  it('starts a command that fits as is', () => {
    expect(processCommand(['status', '--xml'])).toEqual({ args: ['status', '--xml'] });
  });

  it('never starts a process with more than the limit: 20,000 paths go to a cm shell of its own, as one command line', () => {
    const args = checkinArgs(manyPaths, '/tmp/comment.txt', true);
    const { args: started, input } = processCommand(args);
    expect(started).toEqual(['shell', '--encoding=utf-8']);
    expect(fitsCommandLine(started)).toBe(true);
    const [line, exit] = input!.split('\n');
    expect(exit).toBe('exit');
    expect(line!.startsWith('checkin "/Users/ana/work/My Project/Assets/Textures/Level 0/texture_0.png" ')).toBe(true);
    expect(line!.endsWith(' --all --dependencies --private -commentsfile=/tmp/comment.txt --machinereadable --symlink')).toBe(true);
    expect(line!.split('texture_').length - 1).toBe(20_000);
  });

  it('on Windows, runs commands that print text in a cm shell of its own, the only way cm prints them in UTF-8', () => {
    const update = ['update', '--forcedetailedprogress', '--dontmerge'];
    expect(processCommand(update, 'win32')).toEqual({ args: ['shell', '--encoding=utf-8'], input: 'update --forcedetailedprogress --dontmerge\nexit\n' });
    expect(processCommand(['diff', 'cs:4', '--format={path}'], 'win32').input).toBe('diff cs:4 --format={path}\nexit\n');
  });

  it('on every OS, runs an operation in a cm shell of its own, which ends with it', () => {
    const operations = [
      ['update', '--forcedetailedprogress', '--dontmerge'],
      ['checkin', '/wk/a.cs', '-commentsfile=/tmp/c.txt', '--machinereadable'],
      ['undo', '/wk/a.cs'],
      ['undo', '-r', '/wk'],
      ['switch', 'br:/main/task', '--forcedetailedprogress'],
      ['merge', 'br:/main/task', '--merge', '--machinereadable'],
      ['shelveset', 'create', '/wk/a.cs', '--all', '-commentsfile=/tmp/c.txt'],
      ['sync', 'game@local', 'git', 'https://example.com/game.git'],
      ['push', 'br:/main@game@local', 'game@cloud'],
    ];
    for (const platform of ['darwin', 'linux', 'win32'] as const) {
      for (const args of operations) {
        expect(processCommand(args, platform)).toEqual({ args: ['shell', '--encoding=utf-8'], input: `${toShellCommandLine(args)}\nexit\n` });
      }
    }
  });

  // A merge's preview (`--machinereadable` without `--merge`) changes nothing: it is a read.
  it('on macOS and Linux, starts reads as they are', () => {
    for (const args of [['status', '--xml'], ['cat', 'revid:3', '--file=/t/a'], ['version'], ['checkconnection', 'local:8087'], ['merge', 'br:/main/task', '--machinereadable']]) {
      expect(processCommand(args, 'darwin')).toEqual({ args });
      expect(processCommand(args, 'linux')).toEqual({ args });
    }
  });

  it('starts an operation whose arguments a shell line cannot hold as it is', () => {
    const args = ['checkin', '/wk/say "hi".txt', '-commentsfile=/tmp/c.txt'];
    expect(processCommand(args, 'linux')).toEqual({ args });
  });

  // `cm ls` applies `--encoding` to `--xml` only: its records come in UTF-8 only from a `cm shell`.
  it("on Windows, lists items in a cm shell of its own, the field separators of the listing's format and all", () => {
    const listing = ['ls', 'C:\\wk\\Assets\\Señal', TREE_ITEM_FORMAT, '--symlink'];
    expect(processCommand(listing, 'win32')).toEqual({ args: ['shell', '--encoding=utf-8'], input: `${toShellCommandLine(listing)}\nexit\n` });
    expect(processCommand(listing, 'darwin')).toEqual({ args: listing });
  });

  it('on Windows too, starts commands whose output is UTF-8 anyway, and paths a shell line cannot hold', () => {
    for (const args of [['status', '--xml'], ['find', 'branch', '--format={name}', '--encoding=utf-8'], ['cat', 'revid:3', '--file=C:\\t\\a']]) {
      expect(processCommand(args, 'win32')).toEqual({ args });
    }
    expect(processCommand(['annotate', 'C:\\wk\\say "hi".txt'], 'win32')).toEqual({ args: ['annotate', 'C:\\wk\\say "hi".txt'] });
  });
});
