import type { Virtualizer } from '@pierre/diffs';
import type { Editor } from '@pierre/diffs/edit';
import { useEffect, useImperativeHandle, useRef, type RefObject } from 'react';
import type { ChangeRegion } from './changeBlocks';
import { lineAtTopOf, scrollToChange, type ChangeView } from './changeView';
import { isTypingIn } from './pierreDom';
import { useChangeFlash } from './useChangeFlash';
import { useShadowStyle } from './useShadowStyle';

interface ChangeViewOptions {
  /** Receives the diff's side of moving from change to change (`useChangeNavigation`). */
  changeViewRef: RefObject<ChangeView | null> | undefined;
  /** The diff's scrolling element. */
  containerRef: RefObject<HTMLElement | null>;
  /** The diff's virtualizer while it renders only the lines in view. */
  virtualizer: Virtualizer | undefined;
  editor: RefObject<Editor | null>;
  /** Picks the change moved to, for ⌥⌘Z (`useBlockDiscard`). */
  pickChange: (change: ChangeRegion) => void;
}

/**
 * The diff's side of moving from change to change (`ChangeView`): a change moved to is scrolled into view, lit for a
 * moment and picked; while typing, the caret goes on to it.
 */
export function useChangeView({ changeViewRef, containerRef, virtualizer, editor, pickChange }: ChangeViewOptions): void {
  const changeFlash = useChangeFlash();
  useShadowStyle(containerRef, changeFlash.css);
  const stopScrolling = useRef<() => void>(undefined);
  useEffect(() => () => stopScrolling.current?.(), []);

  useImperativeHandle(changeViewRef, () => ({
    reveal: (change: ChangeRegion) => {
      const container = containerRef.current;
      if (!container) return;
      stopScrolling.current?.();
      stopScrolling.current = scrollToChange(container, change, virtualizer);
      changeFlash.light(change.lines);
      pickChange(change);
      // Typing goes on from the change (F7 while typing): the caret would otherwise bring the view back to it.
      const typedInto = editor.current;
      if (typedInto && isTypingIn(container)) {
        typedInto.focus({ lineNumber: Math.min(change.newStart, typedInto.getText().split('\n').length), preventScroll: true });
      }
    },
    lineAtTop: (blocks) => (containerRef.current ? lineAtTopOf(containerRef.current, blocks) : null),
  }));
}
