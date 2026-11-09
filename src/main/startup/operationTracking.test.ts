import type { WebContents } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import type { OperationProgress } from '@shared/domain/operation';
import { runForCaller } from '../ipc/caller';
import { WindowWrites } from '../window/WindowWrites';
import { trackOperations } from './operationTracking';

vi.mock('electron', () => ({ BrowserWindow: { fromWebContents: () => null, getAllWindows: () => [] } }));

/** The page of window 7, which takes every event at once. */
const page = { id: 70, isDestroyed: () => false, isLoading: () => false, send: () => {} } as unknown as WebContents;

function setUp() {
  const started: { operationId: string; windowId: number }[] = [];
  const reported: { operationId: string; progress: OperationProgress }[] = [];
  const icon = {
    started: (operationId: string, windowId: number) => void started.push({ operationId, windowId }),
    reported: (operationId: string, progress: OperationProgress) => void reported.push({ operationId, progress }),
  };
  const watchers = { ignoreOwnWrite: () => {}, workspaceOf: () => undefined };
  const windowWrites = new WindowWrites();
  const operations = trackOperations(watchers, icon, windowWrites, (caller) => (caller === page ? 7 : undefined));
  return { operations, started, reported, windowWrites };
}

describe('trackOperations', () => {
  it("shows a write on the icon of the window that started it, with what it reports; a slow read doesn't show", async () => {
    const { operations, started, reported } = setUp();

    await runForCaller(page, () =>
      operations.run('update-1', async ({ reportProgress }) => {
        reportProgress('Writing resolved files');
      }),
    );
    await runForCaller(page, () => operations.read('lookup-2', async () => {}));

    expect(started).toEqual([{ operationId: 'update-1', windowId: 7 }]);
    expect(reported.map((report) => report.operationId)).toEqual(['update-1']);
  });

  it('shows nothing of an operation no window started', async () => {
    const { operations, started } = setUp();

    await operations.run('update-1', async () => {});

    expect(started).toEqual([]);
  });

  it('holds the close of the window that started a write while it runs; a slow read holds nothing', async () => {
    const { operations, windowWrites } = setUp();
    let finishUpdate!: () => void;

    void runForCaller(page, () => operations.read('lookup-1', () => new Promise<void>(() => {})));
    expect(windowWrites.runningIn([7])).toBe(false);
    const update = runForCaller(page, () => operations.run('update-2', () => new Promise<void>((resolve) => (finishUpdate = resolve))));
    expect(windowWrites.runningIn([7])).toBe(true);

    finishUpdate();
    await update;
    expect(windowWrites.runningIn([7])).toBe(false);
  });
});
