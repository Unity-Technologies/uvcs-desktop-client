import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceChange } from '@shared/domain/workspaceChange';
import { fakeFolderWatches } from './testing/fakeFolderWatches';
import { WorkspaceWatcher } from './WorkspaceWatcher';

let workspacePath: string;

beforeEach(() => {
  vi.useFakeTimers();
  workspacePath = mkdtempSync(join(tmpdir(), 'uvcs-watch-'));
});

afterEach(() => {
  vi.useRealTimers();
});

/** A watcher of a workspace on macOS (one recursive watch) whose file system events the test fires. */
function watching({ platform = 'darwin' as NodeJS.Platform, unwatchable = [] as { path: string; recursive?: boolean }[] } = {}) {
  const watches = fakeFolderWatches(unwatchable);
  const changes: WorkspaceChange[] = [];
  const watcher = new WorkspaceWatcher(workspacePath, (change) => changes.push(change), platform, watches.watch);
  const coverage = watcher.start();
  /** An event of the recursive watch on the workspace, for a `/`-separated path (null: the platform didn't say). */
  const event = (kind: 'rename' | 'change', path: string | null): void => watches.emit(workspacePath, kind, path === null ? null : join(...path.split('/')));
  return { watcher, changes, coverage, watches, event };
}

const fileEdit = (folder: string, pathsChanged = false): WorkspaceChange => ({ content: true, pathsChanged, metadata: false, folders: [folder] });
const WORKSPACE_STATE: WorkspaceChange = { content: false, pathsChanged: false, metadata: true, folders: [] };

describe('WorkspaceWatcher coalesces bursts', () => {
  it('into one change once events stop for 300 ms', () => {
    const { event, changes } = watching();

    event('change', 'src/a.ts');
    vi.advanceTimersByTime(200);
    event('change', 'src/b.ts');
    vi.advanceTimersByTime(299);
    expect(changes).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(changes).toEqual([fileEdit('src')]);
  });

  it('reporting at least every 2 s during a long stream of writes', () => {
    const { event, changes } = watching();

    for (let elapsed = 0; elapsed < 2000; elapsed += 100) {
      event('change', 'src/a.ts');
      vi.advanceTimersByTime(100);
    }
    expect(changes).toHaveLength(1);
  });

  it('naming every folder touched', () => {
    const { event, changes } = watching();

    event('change', 'src/a.ts');
    event('rename', 'README.md');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([{ content: true, pathsChanged: true, metadata: false, folders: ['src', ''] }]);
  });
});

describe('WorkspaceWatcher tells apart', () => {
  const reported = (path: string | null, kind: 'rename' | 'change' = 'change'): WorkspaceChange[] => {
    const { event, changes } = watching();
    event(kind, path);
    vi.advanceTimersByTime(300);
    return changes;
  };

  it('file edits, and additions, deletions and moves', () => {
    expect(reported('src/a.ts')).toEqual([fileEdit('src')]);
    expect(reported('src/new.ts', 'rename')).toEqual([fileEdit('src', true)]);
  });

  it("cm's rewrites of the workspace state in .plastic, whoever ran cm", () => {
    expect(reported('.plastic/plastic.selector')).toEqual([WORKSPACE_STATE]);
    expect(reported('.plastic/plastic.wktree')).toEqual([WORKSPACE_STATE]);
    expect(reported('.plastic/changelists/default.xml')).toEqual([WORKSPACE_STATE]);
  });

  it('from the lock and temp files every cm read writes, which are noise', () => {
    expect(reported('.plastic/plastic.lock')).toEqual([]);
    expect(reported('.plastic')).toEqual([]);
  });

  it('an event without a name (a Windows buffer overflow), which may be anything: everything refreshes', () => {
    expect(reported(null)).toEqual([{ content: true, pathsChanged: true, metadata: true, folders: null }]);
  });
});

describe('WorkspaceWatcher skips what ignore.conf ignores', () => {
  it('from the start', () => {
    writeFileSync(join(workspacePath, 'ignore.conf'), 'Library\n/Build/Output\n');
    const { event, changes } = watching();

    event('change', 'Library/Cache/blob');
    event('change', 'Build/Output/game.exe');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([]);
  });

  it('and as soon as ignore.conf changes', () => {
    const { event, changes } = watching();
    writeFileSync(join(workspacePath, 'ignore.conf'), 'Temp\n');
    event('change', 'ignore.conf');
    vi.advanceTimersByTime(300);
    changes.length = 0;

    event('change', 'Temp/log.txt');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([]);
  });
});

describe("WorkspaceWatcher drops what the app's own writes cause", () => {
  it('while the write runs and a moment after, then reports again', async () => {
    const { watcher, event, changes } = watching();
    let finish = (): void => {};
    watcher.ignoreOwnWrite(new Promise<void>((resolve) => (finish = resolve)));

    event('change', 'src/a.ts');
    finish();
    await vi.advanceTimersByTimeAsync(0);
    event('change', '.plastic/plastic.changes');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([]);

    event('change', 'src/b.ts');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([fileEdit('src')]);
  });

  it('even when the write fails', async () => {
    const { watcher, event, changes } = watching();
    watcher.ignoreOwnWrite(Promise.reject(new Error('cm failed')));
    await vi.advanceTimersByTimeAsync(250);

    event('change', 'src/b.ts');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([fileEdit('src')]);
  });

  it('including the changes gathered just before it started: the app refreshes after it anyway', () => {
    const { watcher, event, changes } = watching();

    event('change', 'src/a.ts');
    watcher.ignoreOwnWrite(new Promise(() => {}));
    vi.advanceTimersByTime(2000);
    expect(changes).toEqual([]);
  });

  it("only the changelist rewrites of a read that writes them back, and nobody else's edits", () => {
    const { watcher, event, changes } = watching();
    watcher.ignoreOwnWrite(new Promise(() => {}), 'changelists');

    event('change', '.plastic/changelists/default.xml');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([]);

    event('change', 'src/a.ts');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([fileEdit('src')]);
  });
});

describe('WorkspaceWatcher', () => {
  it('reports nothing once stopped, not even a burst gathered before, and lets its watches go', () => {
    const { watcher, event, changes, watches } = watching();

    event('change', 'src/a.ts');
    watcher.stop();
    vi.advanceTimersByTime(2000);
    expect(changes).toEqual([]);
    expect(watches.watched().size).toBe(0);
  });

  it('watches the whole tree with one recursive watch on macOS and Windows', () => {
    for (const platform of ['darwin', 'win32'] as const) {
      const { coverage, watches } = watching({ platform });
      expect(coverage).toBe('full');
      expect(watches.watched()).toEqual(new Map([[workspacePath, true]]));
    }
  });

  it('without recursion, still watches the root and .plastic for checkins and switches, and says the watch is partial', () => {
    const { coverage, watches } = watching({ unwatchable: [{ path: workspacePath, recursive: true }] });

    expect(coverage).toBe('partial');
    expect(watches.watched()).toEqual(
      new Map([
        [workspacePath, false],
        [join(workspacePath, '.plastic'), false],
      ]),
    );
  });

  it('watches folder by folder on Linux, skipping ignored folders', () => {
    mkdirSync(join(workspacePath, 'src'));
    mkdirSync(join(workspacePath, 'Library'));
    writeFileSync(join(workspacePath, 'ignore.conf'), 'Library\n');
    const { coverage, watches, changes } = watching({ platform: 'linux' });

    expect(coverage).toBe('full');
    expect([...watches.watched().keys()].sort()).toEqual([workspacePath, join(workspacePath, 'src')].sort());
    watches.emit(join(workspacePath, 'src'), 'change', 'a.ts');
    vi.advanceTimersByTime(300);
    expect(changes).toEqual([fileEdit('src')]);
  });

  it('tells whether a command ran in the workspace, a Windows folder whatever its letter case', () => {
    const { watcher } = watching({ platform: 'darwin' });
    expect(watcher.covers(join(workspacePath, 'src'))).toBe(true);
    expect(watcher.covers(join(workspacePath, '..', 'other'))).toBe(false);

    const onWindows = new WorkspaceWatcher('C:\\Work\\game', () => {}, 'win32', fakeFolderWatches().watch);
    expect(onWindows.covers('c:\\work\\GAME\\src')).toBe(true);
    expect(onWindows.covers('C:\\Work\\game2')).toBe(false);
  });
});
