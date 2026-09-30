import { describe, expect, it } from 'vitest';
import { checkinArgs } from './checkinArgs';
import { fitsCommandLine } from './commandLineLimit';
import { processCommand } from './processCommand';

const manyPaths = Array.from({ length: 20_000 }, (_, index) => `/Users/ana/work/My Project/Assets/Textures/Level ${index % 40}/texture_${index}.png`);

describe('processCommand', () => {
  it('starts a command that fits as is', () => {
    expect(processCommand(['status', '--xml'])).toEqual({ args: ['status', '--xml'] });
  });

  it('never starts a process with more than the limit: 20,000 paths go to a cm shell of its own, as one command line', () => {
    const args = checkinArgs(manyPaths, '/tmp/comment.txt');
    const { args: started, input } = processCommand(args);
    expect(started).toEqual(['shell', '--encoding=utf-8']);
    expect(fitsCommandLine(started)).toBe(true);
    const [line, exit] = input!.split('\n');
    expect(exit).toBe('exit');
    expect(line!.startsWith('checkin "/Users/ana/work/My Project/Assets/Textures/Level 0/texture_0.png" ')).toBe(true);
    expect(line!.endsWith(' --all --private -commentsfile=/tmp/comment.txt --machinereadable --symlink')).toBe(true);
    expect(line!.split('texture_').length - 1).toBe(20_000);
  });

  it('on Windows, runs commands that print text in a cm shell of its own, the only way cm prints them in UTF-8', () => {
    const update = ['update', '--forcedetailedprogress', '--dontmerge'];
    expect(processCommand(update, 'win32')).toEqual({ args: ['shell', '--encoding=utf-8'], input: 'update --forcedetailedprogress --dontmerge\nexit\n' });
    expect(processCommand(['diff', 'cs:4', '--format={path}'], 'win32').input).toBe('diff cs:4 --format={path}\nexit\n');
    expect(processCommand(update, 'linux')).toEqual({ args: update });
    expect(processCommand(update, 'darwin')).toEqual({ args: update });
  });

  it('on Windows too, starts commands whose output is UTF-8 anyway, and paths a shell line cannot hold', () => {
    for (const args of [['status', '--xml'], ['find', 'branch', '--format={name}', '--encoding=utf-8'], ['cat', 'revid:3', '--file=C:\\t\\a']]) {
      expect(processCommand(args, 'win32')).toEqual({ args });
    }
    expect(processCommand(['annotate', 'C:\\wk\\say "hi".txt'], 'win32')).toEqual({ args: ['annotate', 'C:\\wk\\say "hi".txt'] });
  });
});
