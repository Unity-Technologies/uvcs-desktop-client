import { describe, expect, it, vi } from 'vitest';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import { WorkspaceWatchers, type Watcher } from './WorkspaceWatchers';

const CHANGE: WorkspaceChange = { content: true, pathsChanged: false, metadata: false, folders: [''] };

function setUp() {
  const created: (Watcher & { emit: () => void; breaks: () => void; stopped: boolean; ignored: number })[] = [];
  const onChanged = vi.fn();
  const onBroken = vi.fn();
  const onStopped = vi.fn();
  const watchers = new WorkspaceWatchers({ changed: onChanged, broken: onBroken, stopped: onStopped }, (workspacePath, emit, broke) => {
    const watcher = {
      workspacePath,
      stopped: false,
      ignored: 0,
      emit: () => emit(CHANGE),
      breaks: broke,
      start: () => 'full' as const,
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

  it('tells the windows showing a workspace that its watch broke, and that it watches in part from then on', () => {
    const { watchers, created, onBroken } = setUp();
    expect(watchers.watch(1, '/wk/a')).toBe('full');
    watchers.watch(2, '/wk/b');

    created[0]!.breaks();
    expect(onBroken).toHaveBeenCalledExactlyOnceWith([1], '/wk/a');
    expect(watchers.watch(3, '/wk/a')).toBe('partial');
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
});
