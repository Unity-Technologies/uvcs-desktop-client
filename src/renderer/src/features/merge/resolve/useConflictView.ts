import { useImperativeHandle, type RefObject } from 'react';
import { scrollToRows } from '../../diff/viewer/changeView';
import { pierreShadowRoot } from '../../diff/viewer/pierreDom';
import { useChangeFlash } from '../../diff/viewer/useChangeFlash';
import { useShadowStyle } from '../../diff/viewer/useShadowStyle';
import type { StepView } from '../../diff/viewer/useStepNavigation';
import { conflictLinesSelector, conflictsAbove } from './conflictRows';

/**
 * The conflicts view's side of stepping through its conflicts (`ConflictNavigator`): a conflict moved to is scrolled
 * a few rows from the top unless it's all in view, and lit for a moment. Pierre draws each conflict as a row of
 * actions (`data-merge-conflict-actions`, holding our header), its lines and marker rows, down to `marker-end`.
 */
export function useConflictView(viewRef: RefObject<StepView | null> | undefined, surfaceRef: RefObject<HTMLElement | null>): void {
  const flash = useChangeFlash();
  useShadowStyle(surfaceRef, flash.css);

  useImperativeHandle(viewRef, () => ({
    isShown: () => actionRows(surfaceRef.current).length > 0,
    reveal: (index) => {
      const surface = surfaceRef.current;
      const first = actionRows(surface)[index];
      if (!surface || !first) return;
      const rows = conflictRowsFrom(first);
      scrollToRows(surface, first, rows, true);
      flash.light(conflictLinesSelector(rows.flatMap((row) => (row instanceof HTMLElement && row.dataset.lineIndex ? [row.dataset.lineIndex] : []))));
    },
    countAbove: () => {
      const surface = surfaceRef.current;
      if (!surface) return 0;
      return conflictsAbove(
        actionRows(surface).map((row) => row.getBoundingClientRect().top),
        surface.getBoundingClientRect().top,
      );
    },
  }));
}

function actionRows(surface: HTMLElement | null): Element[] {
  return [...(pierreShadowRoot(surface)?.querySelectorAll('[data-merge-conflict-actions]') ?? [])];
}

/** The rows of the conflict whose actions row is `actions`: its lines and markers, down to its end marker. */
function conflictRowsFrom(actions: Element): Element[] {
  const rows: Element[] = [];
  for (let row = actions.nextElementSibling; row; row = row.nextElementSibling) {
    rows.push(row);
    if (row.getAttribute('data-merge-conflict') === 'marker-end') break;
  }
  return rows;
}
