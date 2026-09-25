import { describe, expect, it } from 'vitest';
import type { FailedCommand } from '@shared/ipc';
import { updateStoppedByConflicts } from './updateFailure';

const failed = (output: string, exitCode = 1): FailedCommand => ({ commandLine: 'cm update --dontmerge', exitCode, output, logEntryId: 1 });

describe('updateStoppedByConflicts', () => {
  it('recognizes cm refusing to update over colliding local changes', () => {
    const output = 'The update operation detected conflicts. The operation cannot continue since it was run with the --dontmerge option.\n';
    expect(updateStoppedByConflicts(failed(output))).toBe(true);
  });

  it('ignores other failures', () => {
    expect(updateStoppedByConflicts(failed('Error: The workspace is locked by another operation.'))).toBe(false);
    expect(updateStoppedByConflicts(undefined)).toBe(false);
  });
});
