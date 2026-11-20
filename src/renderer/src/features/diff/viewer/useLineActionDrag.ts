import { useEffect, useRef, useState } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ChangedLine } from './changeBlocks';
import type { LineAction } from './diffAnnotations';
import { lineUnderPointer } from './lineActions';
import { lineActionDragFrom, lineActionDragLines, lineActionDragMoved, lineActionDragTo, type LineActionDrag } from './lineActionDrag';
import type { LineHover } from './LineActionButton';
import { rowUnderPointer } from './pierreDom';

/** A drag going on, and where its "+" marks go across: the left edge of the button it started from. */
export interface DragShown {
  drag: LineActionDrag;
  left: number;
}

export interface LineActionDragging {
  /** Pressed on the "+" of `line`, drawn at `left`: the drag starts, and ends where the pointer is released. */
  start: (line: ChangedLine, left: number) => void;
  /** A drag is going on: the button under the pointer gives way to the drag's marks. */
  active: () => boolean;
  /** Whether the click that follows a press ends a drag the release already acted on (it's not a click on the line). */
  endedDrag: () => boolean;
  shown: StoreApi<DragShown | null>;
}

/**
 * The "+" pressed and dragged over other lines, as on GitHub: the pointer is followed over the code's rows
 * (`rowUnderPointer`), the lines dragged over are outlined in the accent with a "+" on the first and the last
 * (`LineActionDragMarks`), and released, the action runs on all of them (`lineActionDragLines`). Released on the line
 * it started on, it's the click it was. No gutter selection: its fill across both panes was noise for a comment.
 */
export function useLineActionDrag(action: LineAction | undefined, hover: LineHover): LineActionDragging {
  const latest = useRef(action);
  latest.current = action;
  const [dragging] = useState(() => {
    const shown = createStore<DragShown | null>(() => null);
    let actedOnRelease = false;
    const move = (event: PointerEvent): void => {
      const current = shown.getState();
      const row = rowUnderPointer(event.composedPath());
      const line = row && lineUnderPointer(row);
      if (!current || !line) return;
      const drag = lineActionDragTo(current.drag, line);
      if (drag !== current.drag && drag.to.lineNumber !== current.drag.to.lineNumber) shown.setState({ ...current, drag }, true);
    };
    // No text selected as the pointer drags across the code: the press's own `preventDefault` stops it only while
    // the pointer is on the button, which gives way to the drag's marks as it starts.
    const noTextSelection = (event: Event): void => event.preventDefault();
    const stop = (): void => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('selectstart', noTextSelection, true);
      document.documentElement.style.removeProperty('user-select');
    };
    const release = (): void => {
      stop();
      const drag = shown.getState()?.drag;
      shown.setState(null, true);
      hover.release();
      if (!drag || !lineActionDragMoved(drag)) return;
      // The click a release on the button makes comes right after: once it's past, a click is a click again.
      actedOnRelease = true;
      setTimeout(() => (actedOnRelease = false));
      const lines = lineActionDragLines(drag);
      if (latest.current?.offers(lines)) latest.current.run(lines);
    };
    return {
      shown,
      start: (line: ChangedLine, left: number): void => {
        actedOnRelease = false;
        hover.hold();
        shown.setState({ drag: lineActionDragFrom(line), left }, true);
        document.addEventListener('pointermove', move, true);
        document.addEventListener('pointerup', release, true);
        document.addEventListener('selectstart', noTextSelection, true);
        // Inherited into Pierre's shadow DOM, where `selectstart` on the document may come too late.
        document.documentElement.style.setProperty('user-select', 'none');
        window.getSelection()?.removeAllRanges();
      },
      active: (): boolean => shown.getState() !== null,
      endedDrag: (): boolean => {
        const ended = actedOnRelease;
        actedOnRelease = false;
        return ended;
      },
      dispose: stop,
    };
  });
  useEffect(() => dragging.dispose, [dragging]);
  return dragging;
}
