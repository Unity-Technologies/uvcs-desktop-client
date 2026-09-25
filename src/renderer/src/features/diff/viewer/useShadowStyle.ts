import { useEffect, useRef, type RefObject } from 'react';

/**
 * Keeps `css` in a style sheet inside the shadow root of the diff (`@pierre/diffs` renders into one) found in
 * `containerRef`. Changing it restyles lines without making the diff render again.
 */
export function useShadowStyle(containerRef: RefObject<HTMLElement | null>, css: string): void {
  const style = useRef<HTMLStyleElement | null>(null);

  // After every render: the diff (and its shadow root) may have only just appeared.
  useEffect(() => {
    const root = containerRef.current?.querySelector('diffs-container')?.shadowRoot;
    if (!root) return;
    style.current ??= document.createElement('style');
    if (style.current.parentNode !== root) root.append(style.current);
    if (style.current.textContent !== css) style.current.textContent = css;
  });

  useEffect(() => () => style.current?.remove(), []);
}
