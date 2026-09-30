import { useEffect, useRef, useState, type RefObject } from 'react';
import { pierreShadowRoot } from './pierreDom';
import { useShadowStyle } from './useShadowStyle';
import styles from './PaneScrollbars.module.css';

interface PaneScrollbarsProps {
  /** The scrolling element around the diff, which holds its shadow root and these bars. */
  containerRef: RefObject<HTMLElement | null>;
}

/** Where a pane is across the container, and how wide its code is. */
interface Bar {
  left: number;
  width: number;
  scrollWidth: number;
}

/**
 * Hides the panes' own bars: they sit at the end of the file, out of sight, and show only while hovered. The pane
 * keeps the room it made for them.
 */
const HIDE_PANE_BARS_CSS = '[data-code]::-webkit-scrollbar{height:0}';

/**
 * A horizontal scrollbar for each pane of the diff whose lines are wider than it, kept at the bottom of the view. Each
 * pane scrolls sideways on its own while the container scrolls the whole diff down, so the panes' own bars are only
 * reached at the end of the file.
 */
export function PaneScrollbars({ containerRef }: PaneScrollbarsProps) {
  const [bars, setBars] = useState<Bar[]>([]);
  const panes = useRef<HTMLElement[]>([]);
  const barElements = useRef<(HTMLDivElement | null)[]>([]);
  useShadowStyle(containerRef, HIDE_PANE_BARS_CSS);

  useEffect(() => {
    const container = containerRef.current;
    const root = pierreShadowRoot(container);
    if (!container || !root) return;
    let frame = 0;
    const resize = new ResizeObserver(() => schedule());
    const followPane = (event: Event): void => {
      const bar = barElements.current[panes.current.indexOf(event.target as HTMLElement)];
      if (bar && bar.scrollLeft !== (event.target as HTMLElement).scrollLeft) bar.scrollLeft = (event.target as HTMLElement).scrollLeft;
    };
    const measure = (): void => {
      frame = 0;
      const found = [...root.querySelectorAll<HTMLElement>('[data-code]')];
      if (found.length !== panes.current.length || found.some((pane, index) => pane !== panes.current[index])) {
        for (const pane of panes.current) pane.removeEventListener('scroll', followPane);
        resize.disconnect();
        resize.observe(container);
        for (const pane of found) {
          pane.addEventListener('scroll', followPane, { passive: true });
          resize.observe(pane);
        }
        panes.current = found;
      }
      const view = container.getBoundingClientRect();
      const next = found.map((pane) => ({ left: pane.getBoundingClientRect().left - view.left + container.scrollLeft, width: pane.clientWidth, scrollWidth: pane.scrollWidth }));
      setBars((current) => (sameBars(current, next) ? current : next));
    };
    const schedule = (): void => {
      frame ||= requestAnimationFrame(measure);
    };
    // Lines come and go (typing, expanding unchanged lines) without the panes changing size.
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resize.disconnect();
      for (const pane of panes.current) pane.removeEventListener('scroll', followPane);
      panes.current = [];
    };
  });

  // After the bars show, they start where their panes are scrolled to.
  useEffect(() => {
    barElements.current.forEach((bar, index) => {
      const pane = panes.current[index];
      if (bar && pane && bar.scrollLeft !== pane.scrollLeft) bar.scrollLeft = pane.scrollLeft;
    });
  }, [bars]);

  if (!bars.some((bar) => bar.scrollWidth > bar.width + 1)) return null;
  return (
    <div className={styles.bars} aria-hidden>
      {bars.map((bar, index) =>
        bar.scrollWidth > bar.width + 1 ? (
          <div
            key={index}
            ref={(element) => void (barElements.current[index] = element)}
            className={styles.bar}
            style={{ left: bar.left, width: bar.width }}
            onScroll={(event) => {
              const pane = panes.current[index];
              if (pane && pane.scrollLeft !== event.currentTarget.scrollLeft) pane.scrollLeft = event.currentTarget.scrollLeft;
            }}
          >
            <div style={{ width: bar.scrollWidth }} />
          </div>
        ) : null,
      )}
    </div>
  );
}

function sameBars(a: Bar[], b: Bar[]): boolean {
  return a.length === b.length && a.every((bar, index) => bar.left === b[index]!.left && bar.width === b[index]!.width && bar.scrollWidth === b[index]!.scrollWidth);
}
