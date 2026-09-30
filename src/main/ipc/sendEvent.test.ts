import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { BrowserWindow, type WebContents } from 'electron';
import { EVENT_CHANNEL } from '@shared/ipc';
import { runForCaller } from './caller';
import { sendEventTo, sendEventToCaller } from './sendEvent';

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: vi.fn(() => []) } }));

function windowContents(id: number, destroyed = false) {
  return { id, isDestroyed: () => destroyed, isLoading: () => false, send: vi.fn() };
}

/** A page still loading, until `loaded()`. */
function loadingContents(id: number) {
  const page = new EventEmitter();
  let loading = true;
  const contents = Object.assign(page, { id, isDestroyed: () => false, isLoading: () => loading, send: vi.fn() });
  const loaded = (): void => {
    loading = false;
    page.emit('did-finish-load');
  };
  return { contents, loaded };
}

function openWindows(...contents: ReturnType<typeof windowContents>[]) {
  vi.mocked(BrowserWindow.getAllWindows).mockReturnValue(contents.map((webContents) => ({ webContents })) as unknown as BrowserWindow[]);
}

const LOGGED = { id: 1, commandLine: 'cm status', cwd: '/wk', startedAt: 0, durationMs: 3, exitCode: 0, viaShell: true, output: '' };

describe('sendEventToCaller', () => {
  it('sends what an API call caused to the window that made the call only', () => {
    const [caller, other] = [windowContents(1), windowContents(2)];
    openWindows(caller, other);

    runForCaller(caller as unknown as WebContents, () => sendEventToCaller('commandLogged', LOGGED));

    expect(caller.send).toHaveBeenCalledWith(EVENT_CHANNEL, 'commandLogged', LOGGED);
    expect(other.send).not.toHaveBeenCalled();
  });

  it('sends what no call caused to every open window, skipping closed ones', () => {
    const [open, closed] = [windowContents(1), windowContents(2, true)];
    openWindows(open, closed);

    sendEventToCaller('commandLogged', LOGGED);

    expect(open.send).toHaveBeenCalledWith(EVENT_CHANNEL, 'commandLogged', LOGGED);
    expect(closed.send).not.toHaveBeenCalled();
  });
});

describe('sendEventTo', () => {
  it('sends to a page still loading once it has loaded, in order: before, it has no listeners', () => {
    const { contents, loaded } = loadingContents(1);
    const second = { ...LOGGED, id: 2 };

    sendEventTo(contents as unknown as WebContents, 'commandLogged', LOGGED);
    sendEventTo(contents as unknown as WebContents, 'commandLogged', second);
    expect(contents.send).not.toHaveBeenCalled();

    loaded();
    expect(contents.send.mock.calls).toEqual([
      [EVENT_CHANNEL, 'commandLogged', LOGGED],
      [EVENT_CHANNEL, 'commandLogged', second],
    ]);
  });
});
