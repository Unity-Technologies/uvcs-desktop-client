import { useEffect, useRef, useState, type RefObject } from 'react';
import { pierreShadowRoot } from './pierreDom';
import { useShadowStyle } from './useShadowStyle';
import { paneBarOf, paneOverflows, paneScrollbarsCss, samePaneBars, showsPaneBars, type PaneBar } from './paneScrollbarsLayout';
import styles from './PaneScrollbars.module.css';

interface PaneScrollbarsProps {
  /** The scrolling element around the diff, which holds its shadow root and these bars. */
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * A horizontal scrollbar for each pane of the diff whose lines are wider than it, kept at the bottom of the view. Each
 * pane scrolls sideways on its own while the container scrolls the whole diff down, so the panes' own bars are only
 * reached at the end of the file.
 */
export function PaneScrollbars({ containerRef }: PaneScrollbarsProps) {
  const [bars, setBars] = useState<PaneBar[]>([]);
  const panes = useRef<HTMLElement[]>([]);
  const barElements = useRef<(HTMLDivElement | null)[]>([]);
  useShadowStyle(containerRef, paneScrollbarsCss(showsPaneBars(bars)));

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
      const placed = { left: view.left, clientLeft: container.clientLeft, scrollLeft: container.scrollLeft };
      const next = found.map((pane) => paneBarOf({ left: pane.getBoundingClientRect().left, clientWidth: pane.clientWidth, scrollWidth: pane.scrollWidth }, placed));
      setBars((current) => (samePaneBars(current, next) ? current : next));
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

  if (!showsPaneBars(bars)) return null;
  return (
    <div className={styles.bars} aria-hidden data-pane-scrollbars>
      {bars.map((bar, index) =>
        paneOverflows(bar) ? (
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

/** How much of the bottom of `container`'s view the bars cover: their thickness while they show, else 0. */
export function paneScrollbarsHeight(container: HTMLElement): number {
  return container.querySelector<HTMLElement>(':scope > [data-pane-scrollbars]')?.offsetHeight ?? 0;
}
