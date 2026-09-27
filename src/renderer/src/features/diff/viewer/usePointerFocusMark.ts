import { useEffect, useRef, type FocusEvent, type PointerEvent } from 'react';
import { isKeyboardFocusKey } from '../../../lib/inputModality';

/**
 * Marks what took the focus in the diff by a click (or kept it through one). Its ring is for the keyboard only:
 * Chromium draws `:focus-visible` on the focused diff as soon as a key is pressed (the Shift of a Shift+click, typing),
 * so the diff's rings skip marked elements.
 */
export const POINTER_FOCUS_ATTRIBUTE = 'data-pointer-focus';

export function usePointerFocusMark(): { onPointerDownCapture: (event: PointerEvent) => void; onFocus: (event: FocusEvent) => void; onBlur: (event: FocusEvent) => void } {
  // Whether the last thing the user did was with the pointer: then focus arriving now came from it (or from code acting on it).
  const byPointer = useRef(false);
  useEffect(() => {
    const onPointer = (): void => void (byPointer.current = true);
    const onKey = (event: KeyboardEvent): void => {
      if (isKeyboardFocusKey(event.key)) byPointer.current = false;
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, []);

  return {
    // A click drops the ring the keyboard brought, too.
    onPointerDownCapture: (event) => focusedWithin(event.currentTarget)?.setAttribute(POINTER_FOCUS_ATTRIBUTE, ''),
    onFocus: (event) => {
      if (byPointer.current) realTarget(event)?.setAttribute(POINTER_FOCUS_ATTRIBUTE, '');
    },
    onBlur: (event) => realTarget(event)?.removeAttribute(POINTER_FOCUS_ATTRIBUTE),
  };
}

/** The element focused (or blurred), inside the diff's shadow root too. */
function realTarget(event: FocusEvent): Element | undefined {
  const target = event.nativeEvent.composedPath()[0];
  return target instanceof Element ? target : undefined;
}

/** The focused element inside `container`, the diff's shadow root included. */
function focusedWithin(container: Element): Element | undefined {
  const active = document.activeElement;
  if (!active || !container.contains(active)) return undefined;
  return active.shadowRoot?.activeElement ?? active;
}
