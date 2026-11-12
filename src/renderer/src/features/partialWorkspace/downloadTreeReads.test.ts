import { describe, expect, it } from 'vitest';
import type { PartialRule } from '@shared/domain/workspace';
import { canApply, dataByFolder, downloadTreeReads, READ_FAILURE } from './downloadTreeReads';

const rule: PartialRule = { path: '/Assets', load: true };

describe('dataByFolder', () => {
  it('keeps the folders read, by folder, and leaves out those still reading', () => {
    expect(
      dataByFolder([
        { folder: '', data: ['/a'], failed: false },
        { folder: '/b', data: undefined, failed: false },
      ]),
    ).toEqual(new Map([['', ['/a']]]));
  });
});

describe('downloadTreeReads', () => {
  it('keeps what the repository and the workspace read of each folder', () => {
    const reads = downloadTreeReads({
      treeless: false,
      listings: [{ folder: '', data: [], failed: false }],
      loaded: [{ folder: '', data: ['/a'], failed: false }],
    });
    expect(reads.listings).toEqual(new Map([['', []]]));
    expect(reads.loadedIn).toEqual(new Map([['', ['/a']]]));
    expect(reads.failures).toEqual(new Map());
  });

  it('fails a folder whose listing failed, and one whose loaded items failed', () => {
    const reads = downloadTreeReads({
      treeless: false,
      listings: [
        { folder: '', data: [], failed: false },
        { folder: '/a', data: undefined, failed: true },
      ],
      loaded: [{ folder: '/b', data: undefined, failed: true }],
    });
    expect(reads.failures).toEqual(
      new Map([
        ['/a', READ_FAILURE],
        ['/b', READ_FAILURE],
      ]),
    );
  });

  it('fails the root of a workspace with no tree to list, on a shelve', () => {
    const reads = downloadTreeReads({ treeless: true, listings: [], loaded: [] });
    expect(reads.failures).toEqual(new Map([['', READ_FAILURE]]));
  });
});

describe('canApply', () => {
  it('applies only a change, and not while one is applying', () => {
    expect(canApply([rule], false)).toBe(true);
    expect(canApply([], false)).toBe(false);
    expect(canApply([rule], true)).toBe(false);
  });
});
