import { describe, expect, it } from 'vitest';
import { MAX_CHANGED_FOLDERS, mergeWorkspaceChanges, type WorkspaceChange } from './workspaceChange';
import { countedArray } from '../testing/countedReads';

const NOTHING: WorkspaceChange = { content: false, pathsChanged: false, metadata: false, folders: [] };

describe('mergeWorkspaceChanges', () => {
  it('keeps what either change changed', () => {
    const edit = { ...NOTHING, content: true, folders: ['src'] };
    const move = { ...NOTHING, content: true, pathsChanged: true, folders: ['src'] };
    const checkin = { ...NOTHING, metadata: true };
    expect(mergeWorkspaceChanges(edit, checkin)).toEqual({ content: true, pathsChanged: false, metadata: true, folders: ['src'] });
    expect(mergeWorkspaceChanges(move, edit)).toEqual(move);
    expect(mergeWorkspaceChanges(NOTHING, NOTHING)).toEqual(NOTHING);
  });

  it('lists each changed folder once', () => {
    const inSrc = { ...NOTHING, content: true, folders: ['src'] };
    const inRoot = { ...NOTHING, content: true, folders: [''] };
    const merged = [inSrc, inRoot, inSrc, inRoot].reduce<WorkspaceChange>(mergeWorkspaceChanges, NOTHING);
    expect(merged.folders).toEqual(['src', '']);
  });

  it('counts a change anywhere once the folders are unknown or too many', () => {
    const unknown = { ...NOTHING, content: true, folders: null };
    expect(mergeWorkspaceChanges({ ...NOTHING, folders: ['src'] }, unknown).folders).toBeNull();
    expect(mergeWorkspaceChanges(unknown, { ...NOTHING, folders: ['src'] }).folders).toBeNull();

    let batch: WorkspaceChange = NOTHING;
    for (let i = 0; i < MAX_CHANGED_FOLDERS; i++) batch = mergeWorkspaceChanges(batch, { ...NOTHING, folders: [`d${i}`] });
    expect(batch.folders).toHaveLength(MAX_CHANGED_FOLDERS);
    expect(mergeWorkspaceChanges(batch, { ...NOTHING, folders: ['one-more'] }).folders).toBeNull();
  });

  it('stays cheap over a long stream of events in the same folders: each reads only the folders batched, copying none', () => {
    const inFolder = (index: number): WorkspaceChange => ({ ...NOTHING, content: true, folders: [`d${index % 50}`] });
    const fifty = Array.from({ length: 50 }, (_, index) => inFolder(index)).reduce(mergeWorkspaceChanges, NOTHING);
    const { array: folders, reads } = countedArray(fifty.folders!);
    let batch: WorkspaceChange = { ...fifty, folders };
    for (let index = 0; index < 10_000; index++) batch = mergeWorkspaceChanges(batch, inFolder(index));
    expect(batch.folders).toBe(folders);
    expect(reads() / 10_000).toBeLessThanOrEqual(50);
  });
});
