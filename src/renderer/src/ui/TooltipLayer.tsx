import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Kbd } from './Kbd';
import styles from './TooltipLayer.module.css';

interface Tip {
  text: string;
  /** Dimmed second line (`data-tip-sub`). */
  sub?: string;
  /** Shortcut shown as key caps (`data-tip-shortcut`). */
  shortcut?: string;
  /** Pointer position at show time: the tip is anchored to the cursor. */
  pointerX: number;
  pointerY: number;
}

interface Placement {
  top: number;
  left: number;
  side: 'above' | 'below';
  arrowX: number;
}

const SHOW_DELAY = 120;
/** How far up from the hovered node to look for a label cut off with an ellipsis. */
const CLIPPED_SEARCH_DEPTH = 4;

/**
 * The app's one tooltip. Any element with `data-tip` shows it on hover, quickly and styled, instead of the slow
 * system `title`. `data-tip-overflow` shows it only while the element's text is clipped. Labels cut off by CSS
 * `text-overflow: ellipsis` reveal their full text without any attribute.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const hide = (): void => {
      clearTimeout(timer.current);
      setTip(null);
      setPlacement(null);
    };
    const onMove = (event: MouseEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    const onOver = (event: MouseEvent): void => {
      const found = findTip(event.target as Element | null);
      if (!found) return hide();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setTip({ ...found, pointerX: pointer.current.x, pointerY: pointer.current.y }), SHOW_DELAY);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousedown', hide, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('blur', hide);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousedown', hide, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('blur', hide);
    };
  }, []);

  // Just below the cursor, flipping above near the bottom edge. The bubble starts a little left of the cursor and
  // shifts to stay on screen, while its caret keeps pointing at the cursor.
  useLayoutEffect(() => {
    if (!tip || !tipRef.current) return;
    const bubble = tipRef.current.getBoundingClientRect();
    const margin = 8;
    const gap = 18;
    const arrowInset = 18;

    let side: Placement['side'] = 'below';
    let top = tip.pointerY + gap;
    if (top + bubble.height > window.innerHeight - margin) {
      side = 'above';
      top = tip.pointerY - gap - bubble.height;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - bubble.height - margin));
    const left = Math.max(margin, Math.min(tip.pointerX - arrowInset, window.innerWidth - bubble.width - margin));
    const arrowX = Math.max(14, Math.min(tip.pointerX - left, bubble.width - 14));
    setPlacement({ top, left, side, arrowX });
  }, [tip]);

  if (!tip) return null;

  return createPortal(
    <div
      ref={tipRef}
      className={styles.tooltip}
      data-side={placement?.side}
      role="tooltip"
      style={placement ? { top: placement.top, left: placement.left } : { top: -9999, left: -9999 }}
    >
      <div className={styles.main}>
        <span>{tip.text}</span>
        {tip.shortcut && <Kbd keys={tip.shortcut} />}
      </div>
      {tip.sub && <div className={styles.sub}>{tip.sub}</div>}
      {placement && <span className={styles.arrow} style={{ left: placement.arrowX - 5 }} />}
    </div>,
    document.body,
  );
}

function findTip(target: Element | null): Omit<Tip, 'pointerX' | 'pointerY'> | null {
  const host = target?.closest<HTMLElement>('[data-tip]');
  if (host) {
    const text = host.getAttribute('data-tip');
    if (!text || (host.hasAttribute('data-tip-overflow') && !isClipped(host))) return null;
    return { text, sub: host.getAttribute('data-tip-sub') ?? undefined, shortcut: host.getAttribute('data-tip-shortcut') ?? undefined };
  }

  let element = target instanceof HTMLElement ? target : null;
  for (let depth = 0; element && depth < CLIPPED_SEARCH_DEPTH; depth++, element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).textOverflow === 'ellipsis') {
      const text = element.textContent?.trim();
      return text ? { text } : null;
    }
  }
  return null;
}

/** True when the element's text is clipped, or any descendant's is. */
function isClipped(element: HTMLElement): boolean {
  if (element.scrollWidth > element.clientWidth + 1) return true;
  return [...element.querySelectorAll('*')].some((child) => child.scrollWidth > child.clientWidth + 1);
}
