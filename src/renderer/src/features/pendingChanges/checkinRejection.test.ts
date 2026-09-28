import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { FailedCommand } from '@shared/ipc';
import { checkinRejection, overlappingPaths } from './checkinRejection';

const failed = (output: string): FailedCommand => ({ commandLine: 'cm checkin --machinereadable', exitCode: 1, output, logEntryId: 1 });

// What cm 11.0.16 prints when someone checked in to the branch since the workspace was updated.
const MERGE_NEEDED_OUTPUT = [
  'CI_START',
  'STAGE Validating checkin data',
  "MERGE_NEEDED A merge is needed from changeset 'cs:43@rep:game@repserver:local(mount:/)' to changeset 'cs:41@rep:game@repserver:local(mount:/)' in order to checkin. The checkin operation cannot continue. Please run 'cm merge \"cs:43@rep:game@repserver:local\" --merge' at '/work/game' to solve the conflicts. Then, you can retry the checkin operation. 43 41 game local /",
].join('\n');

const entry = (status: DiffEntry['status'], path: string, extra: Partial<DiffEntry> = {}): DiffEntry => ({
  status,
  path,
  itemType: 'file',
  baseRevisionId: 1,
  revisionId: 2,
  repository: 'game@local',
  ...extra,
});

describe('checkinRejection', () => {
  it('reads where the workspace is and where the branch moved', () => {
    expect(checkinRejection(failed(MERGE_NEEDED_OUTPUT))).toEqual({ headChangeset: 43, loadedChangeset: 41 });
  });

  it('understands the plain output too', () => {
    const output = "Error: A merge is needed from changeset 'cs:7' to changeset 'cs:5' in order to checkin.";
    expect(checkinRejection(failed(output))).toEqual({ headChangeset: 7, loadedChangeset: 5 });
  });

  it('ignores other failures', () => {
    expect(checkinRejection(failed('Error: The item src/a.txt is locked by ana.'))).toBeNull();
    expect(checkinRejection(undefined)).toBeNull();
  });
});

describe('overlappingPaths', () => {
  it('finds the files changed on both sides', () => {
    expect(overlappingPaths([entry('changed', 'src/a.txt')], ['src/a.txt', 'src/b.txt'])).toEqual(['src/a.txt']);
  });

  it('counts both ends of an incoming move', () => {
    expect(overlappingPaths([entry('moved', 'src/new.txt', { oldPath: 'src/old.txt' })], ['src/old.txt'])).toEqual(['src/old.txt']);
  });

  it('counts files inside a directory the branch moved or deleted', () => {
    expect(overlappingPaths([entry('deleted', 'src/art', { itemType: 'directory' })], ['src/art/ship.png', 'src/artist.txt'])).toEqual([
      'src/art/ship.png',
    ]);
  });

  it('ignores a directory that only changed because of its contents', () => {
    expect(overlappingPaths([entry('changed', 'src', { itemType: 'directory' }), entry('changed', 'src/a.txt')], ['src/b.txt'])).toEqual([]);
  });
});
