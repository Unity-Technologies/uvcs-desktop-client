import { describe, expect, it, vi } from 'vitest';
import { BrowserWindow, type WebContents } from 'electron';
import { EVENT_CHANNEL } from '@shared/ipc';
import { runForCaller } from './caller';
import { sendEventToCaller } from './sendEvent';

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: vi.fn(() => []) } }));

function windowContents(id: number, destroyed = false) {
  return { id, isDestroyed: () => destroyed, send: vi.fn() };
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
