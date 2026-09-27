import { describe, expect, it } from 'vitest';
import { MAX_CHANGED_FOLDERS, mergeChanges, type WorkspaceChange } from './events';

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

  it('stays cheap over a long stream of events in the same folders', () => {
    let batch: WorkspaceChange = NOTHING;
    const started = performance.now();
    for (let i = 0; i < 200_000; i++) batch = mergeChanges(batch, { ...NOTHING, content: true, folders: [`d${i % 50}`] });
    expect(batch.folders).toHaveLength(50);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
