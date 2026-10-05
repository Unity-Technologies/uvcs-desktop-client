import { describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { EVENT_CHANNEL } from '@shared/ipc';
import type { FakeElectron, FakeWindow } from './testing/fakeElectron';

vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module);

/** `leaveRequests` keeps which windows are closing and whether the app quits: each test takes fresh copies of it and Electron. */
async function setUp() {
  vi.resetModules();
  const { fakeElectron } = (await import('electron')) as unknown as { fakeElectron: FakeElectron };
  fakeElectron.reset();
  const { askBeforeUnloading, continueLeaving, quitStarted } = await import('./leaveRequests');
  const window = fakeElectron.newWindow();
  askBeforeUnloading(window as unknown as BrowserWindow);
  /** The page held its unloading back: it has unsaved edits. */
  const heldBack = (): void => void window.webContents.emit('will-prevent-unload');
  return { fakeElectron, window, heldBack, quitStarted, continueLeaving: (canLeave: boolean) => continueLeaving(window.webContents.id, canLeave) };
}

const closed = (window: FakeWindow): boolean => window.isDestroyed();

describe('leaving a page with unsaved edits', () => {
  it('brings its window forward and asks the page to settle them', async () => {
    const { fakeElectron, window, heldBack } = await setUp();
    fakeElectron.newWindow().focus();

    heldBack();
    expect(fakeElectron.focused()).toBe(window);
    expect(window.webContents.sent).toEqual([[EVENT_CHANNEL, 'leaveRequested', {}]]);
  });

  it('closes the window once settled, when closing it was held back', async () => {
    const { fakeElectron, window, heldBack, continueLeaving } = await setUp();
    window.emit('close');
    heldBack();

    continueLeaving(true);
    expect(closed(window)).toBe(true);
    expect(fakeElectron.app.quits).toBe(0);
  });

  it('quits once settled, when quitting was held back', async () => {
    const { fakeElectron, window, heldBack, quitStarted, continueLeaving } = await setUp();
    quitStarted();
    window.emit('close');
    heldBack();

    continueLeaving(true);
    expect(fakeElectron.app.quits).toBe(1);
  });

  it('reloads the page once settled, when a reload was held back', async () => {
    const { window, heldBack, continueLeaving } = await setUp();
    heldBack();

    continueLeaving(true);
    expect(window.webContents.reloads).toBe(1);
    expect(closed(window)).toBe(false);
  });

  it('stays, and stops quitting, when the user cancels', async () => {
    const { fakeElectron, window, heldBack, quitStarted, continueLeaving } = await setUp();
    quitStarted();
    window.emit('close');
    heldBack();

    continueLeaving(false);
    expect(fakeElectron.app.quits).toBe(0);
    expect(closed(window)).toBe(false);

    // A later reload of the same page isn't taken for the quit it cancelled.
    heldBack();
    continueLeaving(true);
    expect(fakeElectron.app.quits).toBe(0);
    expect(window.webContents.reloads).toBe(1);
  });
});
