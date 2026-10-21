import { getOrCreateWorkerPoolSingleton, type WorkerPoolManager } from '@pierre/diffs/worker';
import { useEffect } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { pierreThemeName } from './pierreOptions';

/**
 * Pierre's worker, which highlights a big text off the main thread while it shows as plain text, when `enabled`.
 * Created with the first such text and kept for the session.
 */
export function useHighlightWorkers(enabled: boolean): WorkerPoolManager | undefined {
  const theme = pierreThemeName(useResolvedTheme());
  const workers = enabled ? highlightWorkers(theme) : undefined;
  // After the render, not during it: with the theme already resolved, Pierre 1.6's `setRenderOptions` tells the
  // components it highlights for at once (`onThemeChange`), and each sets its own state, which React refuses from
  // another component's render ("Cannot update a component while rendering a different component").
  useEffect(() => {
    if (workers && workers.getDiffRenderOptions().theme !== theme) void workers.setRenderOptions({ theme });
  }, [workers, theme]);
  return workers;
}

/**
 * One worker, in the app's theme only: each worker's heap grows by what it highlights (to about 90 MB stepping through
 * a branch's files), and highlighting in both themes at once takes half as much again. So the next text waits for the
 * one before it, and a theme switch highlights again the texts on screen (`setRenderOptions`).
 */
function highlightWorkers(theme: ReturnType<typeof pierreThemeName>): WorkerPoolManager {
  const workers = getOrCreateWorkerPoolSingleton({
    poolOptions: {
      workerFactory: () => new Worker(new URL('./pierreHighlightWorker.ts', import.meta.url), { type: 'module', name: 'Syntax highlighting' }),
      poolSize: 1,
    },
    // The editor's markup (`useTokenTransformer`): the editor attaches to a diff the workers highlighted without Pierre
    // highlighting it again on the main thread (`isReadyToEdit`), and a read-only diff shows the same.
    highlighterOptions: { theme, lineDiffType: 'word', useTokenTransformer: true },
  });
  return workers;
}
