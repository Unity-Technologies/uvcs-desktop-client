import { getOrCreateWorkerPoolSingleton, type WorkerPoolManager } from '@pierre/diffs/worker';

/**
 * Pierre's workers, which highlight a big read-only diff off the main thread while it shows as plain text. Created with
 * the first such diff and kept for the session. They highlight in both themes at once, so switching theme doesn't
 * highlight again; one diff is one task, and a second worker keeps the next diff from waiting on a long one.
 */
export function highlightWorkers(): WorkerPoolManager {
  return getOrCreateWorkerPoolSingleton({
    poolOptions: {
      workerFactory: () => new Worker(new URL('@pierre/diffs/worker/worker.js', import.meta.url), { type: 'module', name: 'Syntax highlighting' }),
      poolSize: 2,
    },
    highlighterOptions: { theme: { light: 'pierre-light', dark: 'pierre-dark' }, lineDiffType: 'word' },
  });
}
