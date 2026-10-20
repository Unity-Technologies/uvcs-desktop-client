import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { openWorkspaceIn, windowAskedBy } from './workspaceWindowChoice';

const pressed = (held: Partial<Record<'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey', boolean>> = {}) => ({
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...held,
});

describe('windowAskedBy', () => {
  it('opens a workspace in this window on a plain click or Enter', () => {
    expect(windowAskedBy(pressed())).toBe('here');
  });

  it('opens it in a new window with Shift held, as dropping a folder does, on every OS', () => {
    expect(windowAskedBy(pressed({ shiftKey: true }))).toBe('newWindow');
  });

  it('leaves Shift with another modifier to the OS and the lists: the workspace opens here', () => {
    expect(windowAskedBy(pressed({ shiftKey: true, metaKey: true }))).toBe('here');
    expect(windowAskedBy(pressed({ shiftKey: true, ctrlKey: true }))).toBe('here');
    expect(windowAskedBy(pressed({ shiftKey: true, altKey: true }))).toBe('here');
  });
});

describe('openWorkspaceIn', () => {
  it('opens the workspace here through the window\'s own opener, asking the main process nothing', () => {
    const openHere = vi.fn();

    openWorkspaceIn('here', '/ws', openHere);

    expect(openHere).toHaveBeenCalledWith('/ws');
    expect(fakeApi.methods()).toEqual([]);
  });

  it('asks for a new window, which the main process brings forward instead where another window shows the workspace', () => {
    fakeApi.answer('windows.openWorkspace', () => undefined);
    const openHere = vi.fn();

    openWorkspaceIn('newWindow', '/ws', openHere);

    expect(openHere).not.toHaveBeenCalled();
    expect(fakeApi.calls()).toEqual([{ method: 'windows.openWorkspace', args: ['/ws'] }]);
  });
});
