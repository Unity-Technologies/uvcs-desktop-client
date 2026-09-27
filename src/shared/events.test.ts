import { describe, expect, it } from 'vitest';
import { mergeChanges, type WorkspaceChange } from './events';

const NOTHING: WorkspaceChange = { content: false, pathsChanged: false, metadata: false };

describe('mergeChanges', () => {
  it('keeps what either change changed', () => {
    const edit = { ...NOTHING, content: true };
    const move = { ...NOTHING, content: true, pathsChanged: true };
    const checkin = { ...NOTHING, metadata: true };
    expect(mergeChanges(edit, checkin)).toEqual({ content: true, pathsChanged: false, metadata: true });
    expect(mergeChanges(move, edit)).toEqual(move);
    expect(mergeChanges(NOTHING, NOTHING)).toEqual(NOTHING);
  });
});
