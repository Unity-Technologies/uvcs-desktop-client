import { QueriesObserver, QueryClient, type QueryObserverResult } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeFrames } from '../../../testing/fakeFrames';
import { watchQueriesByFrame } from './watchQueriesByFrame';

const FILES = 300;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  let reads = 0;
  const queries = Array.from({ length: FILES }, (_, id) => ({
    queryKey: ['version', id],
    queryFn: async () => {
      reads++;
      return `text ${id}`;
    },
  }));
  const observer = new QueriesObserver(client, queries);
  const frames = fakeFrames();
  const handed: QueryObserverResult[][] = [];
  const watch = () => watchQueriesByFrame(observer, frames.clock, (results) => handed.push(results));
  return { observer, frames, handed, watch, reads: () => reads };
}

/** Lets every read answer, and TanStack tell its observers (it batches them on a timer). */
const answerAll = () => vi.runAllTimersAsync();

describe('watchQueriesByFrame', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reads every query once while watched, as a view showing them would', async () => {
    const { watch, reads } = setup();
    watch();
    await answerAll();
    expect(reads()).toBe(FILES);
  });

  it('hands the results over once a frame, however many reads answered in it', async () => {
    const { watch, frames, handed } = setup();
    watch();
    await answerAll();
    expect(handed).toHaveLength(0);

    frames.frame();
    expect(handed).toHaveLength(1);
    expect(handed[0]!.map((result) => result.data)).toEqual(Array.from({ length: FILES }, (_, id) => `text ${id}`));

    frames.frame();
    expect(handed).toHaveLength(1);
  });

  it('hands nothing over once unwatched, and asks for no frame', async () => {
    const { watch, frames, handed } = setup();
    const unwatch = watch();
    await answerAll();
    unwatch();
    frames.frame();
    expect(handed).toHaveLength(0);
    expect(frames.animating()).toBe(false);
  });
});
