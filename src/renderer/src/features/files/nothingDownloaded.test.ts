import { describe, expect, it } from 'vitest';
import type { TreeItem } from '@shared/domain/explorer';
import { showsNothingDownloaded } from './nothingDownloaded';

const file = { path: 'readme.md', name: 'readme.md', itemType: 'file' } as TreeItem;
const listed = (...items: TreeItem[]) => new Map([['', items]]);

describe('showsNothingDownloaded', () => {
  it('shows in a partial workspace whose root holds nothing: the user chooses what to download from it', () => {
    expect(showsNothingDownloaded('partial', listed())).toBe(true);
  });

  it("doesn't once something is downloaded", () => {
    expect(showsNothingDownloaded('partial', listed(file))).toBe(false);
  });

  it("doesn't while the root is still being listed", () => {
    expect(showsNothingDownloaded('partial', new Map())).toBe(false);
  });

  it("doesn't in any other workspace: an empty one there is an empty repository, with nothing to choose", () => {
    for (const kind of ['standard', 'dynamic', undefined] as const) expect(showsNothingDownloaded(kind, listed())).toBe(false);
  });
});
