import { describe, expect, it, vi } from 'vitest';
import type { WatchCoverage } from '@shared/api/workspaces';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import { AFTER_OWN_WRITE_GRACE_MS } from './OwnWrites';
import { WorkspaceWatchers, type Watcher } from './WorkspaceWatchers';

const CHANGE: WorkspaceChange = { content: true, pathsChanged: false, metadata: false, folders: [''] };

type FakeWatcher = Watcher & { emit: () => void; breaks: () => void; startsWatching: (coverage: WatchCoverage) => void; stopped: boolean; ignored: number };

/** Fake watchers that see every change once started: at once, or when the test says (`startsWatching`) with `startsLater`. */
function setUp({ startsLater = false } = {}) {
  const created: FakeWatcher[] = [];
  const onChanged = vi.fn();
  const onBroken = vi.fn();
  const onStopped = vi.fn();
  const watchers = new WorkspaceWatchers({ changed: onChanged, broken: onBroken, stopped: onStopped }, (workspacePath, emit, broke) => {
    let startsWatching: (coverage: WatchCoverage) => void = () => {};
    const started = new Promise<WatchCoverage>((resolve) => (startsWatching = resolve));
    if (!startsLater) startsWatching('full');
    const watcher: FakeWatcher = {
      workspacePath,
      stopped: false,
      ignored: 0,
      emit: () => emit(CHANGE),
      breaks: broke,
      startsWatching: (coverage) => startsWatching(coverage),
      start: () => started,
      covers: (cwd: string) => cwd.startsWith(workspacePath),
      ignoreOwnWrite: () => void watcher.ignored++,
      stop: () => void (watcher.stopped = true),
    };
    created.push(watcher);
    return watcher;
  });
  return { watchers, created, onChanged, onBroken, onStopped };
}

describe('WorkspaceWatchers', () => {
  it('watches each workspace once and reports its changes to the windows showing it', () => {
    const { watchers, created, onChanged } = setUp();
    watchers.watch(1, '/wk/a');
    watchers.watch(2, '/wk/a');
    watchers.watch(3, '/wk/b');

    expect(created.map((watcher) => watcher.workspacePath)).toEqual(['/wk/a', '/wk/b']);
    created[0]!.emit();
    expect(onChanged).toHaveBeenCalledWith([1, 2], '/wk/a', CHANGE);
  });

  it('tells the windows showing a workspace that its watch broke, and that it watches in part from then on', async () => {
    const { watchers, created, onBroken } = setUp();
    expect(await watchers.watch(1, '/wk/a')).toBe('full');
    await watchers.watch(2, '/wk/b');

    created[0]!.breaks();
    expect(onBroken).toHaveBeenCalledExactlyOnceWith([1], '/wk/a');
    expect(await watchers.watch(3, '/wk/a')).toBe('partial');
  });

  it('answers a window once the watcher has started, and takes the workspace as partly watched meanwhile', async () => {
    const { watchers, created } = setUp({ startsLater: true });
    const first = watchers.watch(1, '/wk/a');
    const second = watchers.watch(2, '/wk/a');
    expect(watchers.workspaceOf(1)).toBe('/wk/a');
    expect(watchers.coverageOf('/wk/a')).toBe('partial');

    created[0]!.startsWatching('full');
    expect(await first).toBe('full');
    expect(await second).toBe('full');
    expect(watchers.coverageOf('/wk/a')).toBe('full');
  });

  it('reports a change the watcher sees as it starts to the windows already showing it, and to what listens to the files', async () => {
    const { watchers, created, onChanged } = setUp({ startsLater: true });
    const heard: string[] = [];
    watchers.listen({ changed: (path) => heard.push(path), unwatched: () => undefined });
    const watched = watchers.watch(1, '/wk/a');

    created[0]!.emit();
    created[0]!.startsWatching('full');
    expect(await watched).toBe('full');
    expect(onChanged).toHaveBeenCalledExactlyOnceWith([1], '/wk/a', CHANGE);
    expect(heard).toEqual(['/wk/a']);
  });

  it('stops a watcher still starting once no window shows its workspace', async () => {
    const { watchers, created, onStopped } = setUp({ startsLater: true });
    const watched = watchers.watch(1, '/wk/a');

    watchers.release(1);
    expect(created[0]!.stopped).toBe(true);
    expect(onStopped).toHaveBeenCalledExactlyOnceWith('/wk/a');
    created[0]!.startsWatching('partial');
    expect(await watched).toBe('partial');
    expect(watchers.coverageOf('/wk/a')).toBeUndefined();
  });

  it('stops watching a workspace once no window shows it', () => {
    const { watchers, created, onStopped } = setUp();
    watchers.watch(1, '/wk/a');
    watchers.watch(2, '/wk/a');

    watchers.watch(1, '/wk/b');
    expect(created[0]!.stopped).toBe(false);
    expect(onStopped).not.toHaveBeenCalled();
    watchers.release(2);
    expect(created[0]!.stopped).toBe(true);
    expect(onStopped).toHaveBeenCalledExactlyOnceWith('/wk/a');
    expect(watchers.workspaceOf(1)).toBe('/wk/b');
    expect(watchers.workspaceOf(2)).toBeUndefined();
  });

  it('keeps the watcher when a window asks for the workspace it already shows', () => {
    const { watchers, created } = setUp();
    watchers.watch(1, '/wk/a');
    watchers.watch(1, '/wk/a');
    expect(created).toHaveLength(1);
    expect(created[0]!.stopped).toBe(false);
  });

  it('ignores own writes only in the workspace they touch', () => {
    const { watchers, created } = setUp();
    watchers.watch(1, '/wk/a');
    watchers.watch(2, '/wk/b');

    watchers.ignoreOwnWrite(Promise.resolve(), '/wk/b/src');
    expect(created.map((watcher) => watcher.ignored)).toEqual([0, 1]);
    watchers.ignoreOwnWrite(Promise.resolve());
    expect(created.map((watcher) => watcher.ignored)).toEqual([1, 2]);
  });

  it('tells what listens to the files every change, and when they stop being all seen', () => {
    const { watchers, created } = setUp();
    const heard: string[] = [];
    const stop = watchers.listen({ changed: (path, change) => heard.push(`${path} changed in ${change.folders}`), unwatched: (path) => heard.push(`${path} unwatched`) });
    watchers.watch(1, '/wk/a');
    watchers.watch(2, '/wk/b');

    created[0]!.emit();
    created[1]!.breaks();
    watchers.release(1);
    stop();
    created[1]!.emit();
    expect(heard).toEqual(['/wk/a changed in ', '/wk/b unwatched', '/wk/a unwatched']);
  });

  it("tells what listens to the files that the app's own write changed anything, once it settles, though the windows don't hear it", async () => {
    const { watchers } = setUp();
    const heard: string[] = [];
    watchers.listen({ changed: (path, change) => heard.push(`${path} changed in ${change.folders === null ? 'anywhere' : change.folders}`), unwatched: () => undefined });
    watchers.watch(1, '/wk/a');
    watchers.watch(2, '/wk/b');

    let finish = () => {};
    const write = new Promise<void>((resolve) => (finish = resolve));
    watchers.ignoreOwnWrite(write, '/wk/a/src');
    watchers.ignoreOwnWrite(Promise.resolve(), '/wk/a', 'changelists');
    expect(heard).toEqual([]);
    finish();
    await write;
    await Promise.resolve();
    expect(heard).toEqual(['/wk/a changed in anywhere']);
  });

  it("tells what listens to the files again once the own write's grace ends: a change the watcher dropped meanwhile isn't lost", async () => {
    vi.useFakeTimers();
    try {
      const { watchers } = setUp();
      const heard: string[] = [];
      watchers.listen({ changed: (path, change) => heard.push(`${path} changed in ${change.folders === null ? 'anywhere' : change.folders}`), unwatched: () => undefined });
      watchers.watch(1, '/wk/a');
      const write = Promise.resolve();
      watchers.ignoreOwnWrite(write, '/wk/a');
      await write;
      await Promise.resolve();
      expect(heard).toEqual(['/wk/a changed in anywhere']);
      await vi.advanceTimersByTimeAsync(AFTER_OWN_WRITE_GRACE_MS);
      expect(heard).toEqual(['/wk/a changed in anywhere', '/wk/a changed in anywhere']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tells how much of a workspace its watcher sees, and nothing for one not watched', async () => {
    const { watchers, created } = setUp();
    await watchers.watch(1, '/wk/a');
    expect(watchers.coverageOf('/wk/a')).toBe('full');
    created[0]!.breaks();
    expect(watchers.coverageOf('/wk/a')).toBe('partial');
    expect(watchers.coverageOf('/wk/b')).toBeUndefined();
  });
});
