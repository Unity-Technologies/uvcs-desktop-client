import { describe, expect, it } from 'vitest';
import { readPartialUpdateProgress } from './progress/partialUpdateProgress';
import { readUpdateProgress } from './progress/updateProgress';
import { switchCommand, updateCommand } from './updateArgs';

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
