import { describe, expect, it } from 'vitest';
import { readProgress } from './progressReader';
import { readShelveProgress } from './shelveProgress';

/** Real output of `cm shelveset create <wk> --all -commentsfile=…` (100 edits, 3 new 50 MB files). */
const SHELVE = [
  'Uploading file data',
  'Confirming checkin operation',
  'Modified /private/tmp/prog/wkA',
  'Added /private/tmp/prog/wkA/newbins',
  'Modified /private/tmp/prog/wkA/src/short/s7.txt',
  "Created shelve sh:2@progtest@local (mount:'/')",
];

describe('readShelveProgress', () => {
  it('uploads first', () => {
    expect(readProgress(readShelveProgress, SHELVE.slice(0, 1))).toEqual({ stage: 'uploading', stageLabel: 'Uploading', fraction: null, cancellable: true });
  });

  it('then confirms, and the report keeps it there', () => {
    expect(readProgress(readShelveProgress, SHELVE.slice(0, 2))).toMatchObject({ stage: 'confirming', cancellable: false });
    expect(readProgress(readShelveProgress, SHELVE)).toMatchObject({ stage: 'confirming' });
  });
});
