import { describe, expect, it } from 'vitest';
import { MAX_CHANGED_FOLDERS, mergeChanges, type WorkspaceChange } from './workspaceChange';
import { countedArray } from '../testing/countedReads';

const NOTHING: WorkspaceChange = { content: false, pathsChanged: false, metadata: false, folders: [] };

describe('mergeChanges', () => {
  it('keeps what either change changed', () => {
    const edit = { ...NOTHING, content: true, folders: ['src'] };
    const move = { ...NOTHING, content: true, pathsChanged: true, folders: ['src'] };
    const checkin = { ...NOTHING, metadata: true };
    expect(mergeChanges(edit, checkin)).toEqual({ content: true, pathsChanged: false, metadata: true, folders: ['src'] });
    expect(mergeChanges(move, edit)).toEqual(move);
    expect(mergeChanges(NOTHING, NOTHING)).toEqual(NOTHING);
  });

  it('lists each changed folder once', () => {
    const inSrc = { ...NOTHING, content: true, folders: ['src'] };
    const inRoot = { ...NOTHING, content: true, folders: [''] };
    const merged = [inSrc, inRoot, inSrc, inRoot].reduce<WorkspaceChange>(mergeChanges, NOTHING);
    expect(merged.folders).toEqual(['src', '']);
  });

  it('counts a change anywhere once the folders are unknown or too many', () => {
    const unknown = { ...NOTHING, content: true, folders: null };
    expect(mergeChanges({ ...NOTHING, folders: ['src'] }, unknown).folders).toBeNull();
    expect(mergeChanges(unknown, { ...NOTHING, folders: ['src'] }).folders).toBeNull();

    let batch: WorkspaceChange = NOTHING;
    for (let i = 0; i < MAX_CHANGED_FOLDERS; i++) batch = mergeChanges(batch, { ...NOTHING, folders: [`d${i}`] });
    expect(batch.folders).toHaveLength(MAX_CHANGED_FOLDERS);
    expect(mergeChanges(batch, { ...NOTHING, folders: ['one-more'] }).folders).toBeNull();
  });

  it('stays cheap over a long stream of events in the same folders: each reads only the folders batched, copying none', () => {
    const inFolder = (index: number): WorkspaceChange => ({ ...NOTHING, content: true, folders: [`d${index % 50}`] });
    const fifty = Array.from({ length: 50 }, (_, index) => inFolder(index)).reduce(mergeChanges, NOTHING);
    const { array: folders, reads } = countedArray(fifty.folders!);
    let batch: WorkspaceChange = { ...fifty, folders };
    for (let index = 0; index < 10_000; index++) batch = mergeChanges(batch, inFolder(index));
    expect(batch.folders).toBe(folders);
    expect(reads() / 10_000).toBeLessThanOrEqual(50);
  });
});
