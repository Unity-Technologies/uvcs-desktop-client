import { describe, expect, it } from 'vitest';
import { isFileDrag, isFolderDragOver, nextFolderDragState, NO_FOLDER_DRAG, type FolderDragEvent, type FolderDragState } from './folderDragState';

function after(events: FolderDragEvent[], from: FolderDragState = NO_FOLDER_DRAG): FolderDragState {
  return events.reduce(nextFolderDragState, from);
}

const enter: FolderDragEvent = { type: 'enter', shiftKey: false };
const over: FolderDragEvent = { type: 'over', shiftKey: false };
const leaveToElement: FolderDragEvent = { type: 'leave', leftWindow: false };
const leaveWindow: FolderDragEvent = { type: 'leave', leftWindow: true };

describe('nextFolderDragState', () => {
  it('is over the window from the first element entered', () => {
    expect(isFolderDragOver(after([enter]))).toBe(true);
  });

  it('stays over the window while the pointer crosses from one element to another', () => {
    // The new element's enter comes before the old one's leave.
    expect(isFolderDragOver(after([enter, enter, leaveToElement, enter, leaveToElement]))).toBe(true);
  });

  it('ends when every element entered was left', () => {
    expect(isFolderDragOver(after([enter, enter, leaveToElement, leaveToElement]))).toBe(false);
  });

  it('ends when the pointer leaves the window, even if an element never sent its leave', () => {
    // The element under the pointer unmounted: its leave never came.
    expect(after([enter, enter, enter, leaveWindow])).toEqual(NO_FOLDER_DRAG);
  });

  it('ends on a drop, a dragend or a pointer move', () => {
    expect(after([enter, enter, { type: 'end' }])).toEqual(NO_FOLDER_DRAG);
  });

  it('counts a drag already over the window when the page started listening from its first dragover', () => {
    expect(isFolderDragOver(after([over]))).toBe(true);
    expect(isFolderDragOver(after([over, leaveToElement]))).toBe(false);
  });

  it('opens in a new window while Shift is held, and in this one again once it is released', () => {
    const shifted = after([enter, { type: 'over', shiftKey: true }]);
    expect(shifted.newWindow).toBe(true);
    expect(after([over], shifted).newWindow).toBe(false);
  });

  it('keeps the same state for a dragover that changes nothing, so the overlay does not render again', () => {
    const state = after([enter]);
    expect(nextFolderDragState(state, over)).toBe(state);
    expect(nextFolderDragState(NO_FOLDER_DRAG, { type: 'end' })).toBe(NO_FOLDER_DRAG);
  });

  it('never counts below zero', () => {
    expect(after([leaveToElement, leaveToElement])).toEqual(NO_FOLDER_DRAG);
  });
});

describe('isFileDrag', () => {
  it('takes drags of files from the file manager', () => {
    expect(isFileDrag(['Files'])).toBe(true);
  });

  it("ignores the app's own drags and dragged text", () => {
    expect(isFileDrag(['application/x-uvcs-pending-changes'])).toBe(false);
    expect(isFileDrag(['text/plain'])).toBe(false);
  });
});
