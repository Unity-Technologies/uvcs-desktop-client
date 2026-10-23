import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it, vi } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { newWindowRunOf, windowAskedBy, workspaceOpener } from './workspaceWindowChoice';

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

  it('always opens a missing workspace here, where the user locates, recreates or forgets it', () => {
    expect(windowAskedBy(pressed({ shiftKey: true }), { missing: true })).toBe('here');
    expect(windowAskedBy(pressed({ shiftKey: true }), { missing: false })).toBe('newWindow');
  });
});

describe('workspaceOpener', () => {
  it("opens the workspace here through the window's own opener, asking the main process nothing", () => {
    const openHere = vi.fn();

    workspaceOpener(openHere)('/ws', 'here');

    expect(openHere).toHaveBeenCalledWith('/ws');
    expect(fakeApi.methods()).toEqual([]);
  });

  it('asks for a new window, which the main process brings forward instead where another window shows the workspace', () => {
    fakeApi.answer('windows.openPlace', () => undefined);
    const openHere = vi.fn();

    workspaceOpener(openHere)('/ws', 'newWindow');

    expect(openHere).not.toHaveBeenCalled();
    expect(fakeApi.calls()).toEqual([{ method: 'windows.openPlace', args: [workspacePlace('/ws')] }]);
  });
});

describe('newWindowRunOf', () => {
  const workspaceResult = { runInNewWindow: () => {} };

  it("takes a palette result's new window run with Shift held", () => {
    expect(newWindowRunOf(workspaceResult, pressed({ shiftKey: true }))).toBe(workspaceResult.runInNewWindow);
  });

  it('leaves the result to its own run without Shift, or when it has no new window to open in', () => {
    expect(newWindowRunOf(workspaceResult, pressed())).toBeUndefined();
    expect(newWindowRunOf({}, pressed({ shiftKey: true }))).toBeUndefined();
    expect(newWindowRunOf(undefined, pressed({ shiftKey: true }))).toBeUndefined();
  });
});
