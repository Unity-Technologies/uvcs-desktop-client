import { EventEmitter } from 'node:events';
import type { WebContents } from 'electron';
import { describe, expect, it } from 'vitest';
import type { IssueTrackers } from '../issueTrackers/IssueTrackers';
import { runForCaller } from '../ipc/caller';
import { createIssueTrackersService } from './issueTrackersService';
import type { ServiceContext } from './ServiceContext';

/** A window's web contents as the service sees it: its id, whether it's gone, and its events. */
class FakeWindow extends EventEmitter {
  destroyed = false;
  constructor(readonly id: number) {
    super();
  }
  isDestroyed(): boolean {
    return this.destroyed;
  }
}

function service() {
  const closed: number[] = [];
  const engine = {
    startDeviceSignIn: async () => ({ flowId: 'f', userCode: 'C', verificationUri: 'https://github.com/login/device', expiresAt: 0 }),
    windowClosed: (id: number) => closed.push(id),
  } as unknown as IssueTrackers;
  return { closed, api: createIssueTrackersService({ issueTrackers: engine } as ServiceContext) };
}

const start = (api: ReturnType<typeof service>['api'], window: FakeWindow) =>
  runForCaller(window as unknown as WebContents, () => api.startDeviceSignIn({ repository: 'game@acme@unity', link: 'https://github.com/acme/game/issues/1' }));

describe('the issue trackers service', () => {
  it('ends a window’s device flows when it closes, watching each window once', async () => {
    const { api, closed } = service();
    const window = new FakeWindow(7);
    for (let i = 0; i < 12; i++) await start(api, window);
    expect(window.listenerCount('destroyed')).toBe(1);
    window.emit('destroyed');
    expect(closed).toEqual([7]);
  });

  it('ends them when the window reloads or leaves its page, not on a frame’s or the same page’s navigation', async () => {
    const { api, closed } = service();
    const window = new FakeWindow(8);
    await start(api, window);
    window.emit('did-start-navigation', { isMainFrame: false, isSameDocument: false });
    window.emit('did-start-navigation', { isMainFrame: true, isSameDocument: true });
    expect(closed).toEqual([]);
    window.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false });
    expect(closed).toEqual([8]);
  });

  it('ends a flow at once when its window closed while it started', async () => {
    const { api, closed } = service();
    const window = new FakeWindow(9);
    const started = start(api, window);
    window.destroyed = true;
    await started;
    expect(closed).toEqual([9]);
  });
});
