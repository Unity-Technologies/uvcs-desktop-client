import { describe, expect, it } from 'vitest';
import { blockedMessage, collisionNote, updateBarMessage } from './collisionMessages';

describe('blockedMessage', () => {
  it('counts the blocking files instead of listing them, which the list shows', () => {
    expect(blockedMessage(6, '/main', 0)).toBe('6 files you changed were deleted or moved on main.');
    expect(blockedMessage(1, '/main', 0)).toBe('A file you changed was deleted or moved on main.');
  });

  it('tells about the files that still need merging too', () => {
    expect(blockedMessage(2, '/main', 1)).toBe('2 files you changed were deleted or moved on main. 1 other needs merging.');
    expect(blockedMessage(1, '/main', 3)).toBe('A file you changed was deleted or moved on main. 3 others need merging.');
  });
});

describe('updateBarMessage', () => {
  it('says what updating brings when nothing collides', () => {
    expect(updateBarMessage(1, '/main', 0, 0)).toBe('Update to get 1 new changeset. Your local changes stay as they are.');
    expect(updateBarMessage(3, '/main', 0, 0)).toBe('Update to get 3 new changesets. Your local changes stay as they are.');
  });

  it('agrees in number with the files to merge', () => {
    expect(updateBarMessage(3, '/main', 1, 1)).toBe('A file you changed also changed on main. Merge it to update.');
    expect(updateBarMessage(3, '/main', 2, 2)).toBe('2 files you changed also changed on main. Merge them to update.');
  });

  it('counts down the files left to merge', () => {
    expect(updateBarMessage(3, '/main', 3, 1)).toBe('1 of 3 files changed on both sides still needs merging.');
    expect(updateBarMessage(3, '/main', 3, 2)).toBe('2 of 3 files changed on both sides still need merging.');
  });

  it('asks to update once every file is merged', () => {
    expect(updateBarMessage(3, '/main', 1, 0)).toBe('The file is merged. Update to apply it.');
    expect(updateBarMessage(3, '/main', 2, 0)).toBe('All 2 files are merged. Update to apply them.');
  });
});

describe('collisionNote', () => {
  it('tells files to merge from files the branch deleted or moved, which have to be shelved', () => {
    expect(collisionNote(1, 0)).toBe('A file you changed was also changed there. Merge it in Incoming to update.');
    expect(collisionNote(2, 0)).toBe('2 files you changed were also changed there. Merge them in Incoming to update.');
    expect(collisionNote(0, 6)).toBe('6 files you changed were deleted or moved there. Shelve them in Incoming to update.');
    expect(collisionNote(2, 6)).toBe('8 files you changed were also changed, deleted or moved there. Sort them out in Incoming to update.');
  });
});
