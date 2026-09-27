import type { WorkspaceChange } from '@shared/events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeBatcher } from './ChangeBatcher';

const edit: WorkspaceChange = { content: true, pathsChanged: false, metadata: false, folders: ['src'] };
const checkin: WorkspaceChange = { content: false, pathsChanged: false, metadata: true, folders: [] };

describe('ChangeBatcher', () => {
  let flushed: WorkspaceChange[];
  let batcher: ChangeBatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    flushed = [];
    batcher = new ChangeBatcher((change) => flushed.push(change), 300, 2000);
  });

  afterEach(() => vi.useRealTimers());

  it('folds a burst into one batch once events stop', () => {
    for (let i = 0; i < 500; i++) batcher.add(edit);
    batcher.add(checkin);
    vi.advanceTimersByTime(299);
    expect(flushed).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(flushed).toEqual([{ content: true, pathsChanged: false, metadata: true, folders: ['src'] }]);
  });

  it('flushes a stream that never pauses at the max wait', () => {
    for (let elapsed = 0; elapsed < 5000; elapsed += 100) {
      batcher.add(edit);
      vi.advanceTimersByTime(100);
    }
    expect(flushed).toHaveLength(2);
  });

  it('drops a cancelled batch', () => {
    batcher.add(edit);
    batcher.cancel();
    vi.advanceTimersByTime(5000);
    expect(flushed).toEqual([]);
  });
});
