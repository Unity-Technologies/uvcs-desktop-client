import { getOrCreateWorkerPoolSingleton, type WorkerPoolManager } from '@pierre/diffs/worker';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { pierreThemeName } from './pierreOptions';

/**
 * Pierre's worker, which highlights a big read-only text off the main thread while it shows as plain text, when
 * `enabled`. Created with the first such text and kept for the session.
 */
export function useHighlightWorkers(enabled: boolean): WorkerPoolManager | undefined {
  const theme = pierreThemeName(useResolvedTheme());
  return enabled ? highlightWorkers(theme) : undefined;
}

/**
 * One worker, in the app's theme only: each worker's heap grows by what it highlights (to about 90 MB stepping through
 * a branch's files), and highlighting in both themes at once takes half as much again. So the next text waits for the
 * one before it, and a theme switch highlights again the texts on screen (`setRenderOptions`).
 */
function highlightWorkers(theme: ReturnType<typeof pierreThemeName>): WorkerPoolManager {
  const workers = getOrCreateWorkerPoolSingleton({
    poolOptions: {
      workerFactory: () => new Worker(new URL('@pierre/diffs/worker/worker.js', import.meta.url), { type: 'module', name: 'Syntax highlighting' }),
      poolSize: 1,
    },
    highlighterOptions: { theme, lineDiffType: 'word' },
  });
  if (workers.getDiffRenderOptions().theme !== theme) void workers.setRenderOptions({ theme });
  return workers;
}
