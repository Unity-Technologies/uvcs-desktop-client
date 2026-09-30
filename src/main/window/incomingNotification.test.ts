import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENT_CHANNEL } from '@shared/ipc';
import { showIncomingNotification } from './incomingNotification';
import { fakeElectron, type FakeWindow } from './testing/fakeElectron';
import type { WorkspaceWindows } from './WorkspaceWindows';

const notifications = vi.hoisted(() => ({ shown: [] as EventEmitter[], supported: true }));

vi.mock('electron', async () => {
  const { fakeElectron } = await import('./testing/fakeElectron');
  const { EventEmitter: Emitter } = await import('node:events');
  class Notification extends Emitter {
    static isSupported = () => notifications.supported;
    constructor(readonly options: { title: string }) {
      super();
    }
    show = () => void notifications.shown.push(this);
  }
  return { ...fakeElectron.module, Notification };
});

beforeEach(() => {
  fakeElectron.reset();
  notifications.shown.length = 0;
  notifications.supported = true;
});

/** Windows where `game` (if given) shows /work/game. */
function windowsShowing(game?: FakeWindow) {
  const focusAny = vi.fn();
  const windows = { windowShowing: (path: string) => (path === '/work/game' ? game : undefined), focusAny } as unknown as WorkspaceWindows;
  return { windows, focusAny };
}

describe('showIncomingNotification', () => {
  it('leads to Incoming in the window showing the workspace, brought forward, when clicked', () => {
    const game = fakeElectron.newWindow();
    game.minimize();
    showIncomingNotification(windowsShowing(game).windows, '/work/game', 'Ana checked in to /main');

    expect(notifications.shown).toEqual([expect.objectContaining({ options: { title: 'Ana checked in to /main', silent: true } })]);
    notifications.shown[0]!.emit('click');
    expect(fakeElectron.focused()).toBe(game);
    expect(game.webContents.sent).toEqual([[EVENT_CHANNEL, 'incomingNotificationClicked', { workspacePath: '/work/game' }]]);
  });

  it('brings the app forward when no window shows the workspace anymore', () => {
    const { windows, focusAny } = windowsShowing();
    showIncomingNotification(windows, '/work/game', 'Ana checked in to /main');

    notifications.shown[0]!.emit('click');
    expect(focusAny).toHaveBeenCalled();
  });

  it('shows nothing where the system has no notifications', () => {
    notifications.supported = false;
    showIncomingNotification(windowsShowing().windows, '/work/game', 'Ana checked in to /main');
    expect(notifications.shown).toEqual([]);
  });
});
