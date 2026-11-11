import { describe, expect, it } from 'vitest';
import { readPartialUpdateProgress } from './progress/partialUpdateProgress';
import { readUpdateProgress } from './progress/updateProgress';
import { fitsCommandLine } from './commandLineLimit';
import { partialUpdateCommands, switchCommand, updateCommand } from './updateArgs';

describe('updateCommand', () => {
  it('updates a standard or dynamic workspace with cm update, its detailed progress kept', () => {
    for (const kind of ['standard', 'dynamic'] as const) {
      expect(updateCommand(kind)).toEqual({ args: ['update', '--forcedetailedprogress', '--noinput', '--dontmerge'], readProgress: readUpdateProgress });
    }
  });

  // cm partial update refuses --forcedetailedprogress and --noinput: it always prints its progress line and never asks.
  it('updates a partial workspace with cm partial update, read by its own progress reader', () => {
    expect(updateCommand('partial')).toEqual({ args: ['partial', 'update', '--dontmerge'], readProgress: readPartialUpdateProgress });
  });
});

describe('partialUpdateCommands', () => {
  it('updates just the paths given, in one command when they fit', () => {
    expect(partialUpdateCommands(['Code/Ship.cs', 'Art'])).toEqual([
      { args: ['partial', 'update', 'Code/Ship.cs', 'Art', '--dontmerge'], readProgress: readPartialUpdateProgress },
    ]);
  });

  it('splits paths that would overflow one command line across commands, each fitting, none lost', () => {
    const paths = Array.from({ length: 2_000 }, (_, index) => `Assets/Folder number ${index}/File.cs`);
    const commands = partialUpdateCommands(paths);
    expect(commands.length).toBeGreaterThan(1);
    expect(commands.every(({ args }) => fitsCommandLine(args) && args[0] === 'partial' && args.at(-1) === '--dontmerge')).toBe(true);
    expect(commands.flatMap(({ args }) => args.slice(2, -1))).toEqual(paths);
  });

  it('runs nothing for no paths', () => {
    expect(partialUpdateCommands([])).toEqual([]);
  });
});

describe('switchCommand', () => {
  it('switches a standard or dynamic workspace with cm switch', () => {
    for (const kind of ['standard', 'dynamic'] as const) {
      expect(switchCommand('br:/main/task', kind)).toEqual({ args: ['switch', 'br:/main/task', '--forcedetailedprogress', '--noinput'], readProgress: readUpdateProgress });
    }
  });

  it('switches a partial workspace with cm partial switch, which prints the partial update progress', () => {
    expect(switchCommand('br:/main/task', 'partial')).toEqual({ args: ['partial', 'switch', 'br:/main/task', '--noinput'], readProgress: readPartialUpdateProgress });
  });
});
