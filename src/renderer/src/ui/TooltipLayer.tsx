import { useEffect, useRef, useState } from 'react';
import { followTip, type TipText } from './followTip';
import { TooltipBubble } from './TooltipBubble';
import { listenForTooltips } from './tooltipEvents';

/** `sub` is `data-tip-sub`, `shortcut` is `data-tip-shortcut`. */
interface FoundTip extends TipText {
  /** The element the tip is read from: followed while it shows. */
  host: Element;
}

interface Tip extends FoundTip {
  /** Pointer position at show time: the tip is anchored to the cursor. */
  pointerX: number;
  pointerY: number;
}

/** How long the pointer rests on something before its tooltip shows; canvas tooltips wait the same. */
export const TOOLTIP_SHOW_DELAY = 120;
/** How far up from the hovered node to look for a label cut off with an ellipsis. */
const CLIPPED_SEARCH_DEPTH = 4;

/**
 * The app's one tooltip. Any element with `data-tip` shows it on hover, quickly and styled, instead of the slow
 * system `title`. `data-tip-overflow` shows it only while the element's text is clipped. Labels cut off by CSS
 * `text-overflow: ellipsis` reveal their full text without any attribute. While it shows, it follows its element: new
 * words under the still pointer (the status bar after a switch) show at once, and it goes when the element does.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const hide = (): void => {
      clearTimeout(timer.current);
      setTip(null);
    };
    const onMove = (event: MouseEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY };
    };
    const onOver = (event: MouseEvent): void => {
      // Inside a shadow root (the diff viewers), the target is the host: look from the node really hovered first.
      const origin = event.composedPath()[0];
      const found = (origin instanceof Element && origin !== event.target ? findTip(origin) : null) ?? findTip(event.target as Element | null);
      if (!found) return hide();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setTip({ ...found, pointerX: pointer.current.x, pointerY: pointer.current.y }), TOOLTIP_SHOW_DELAY);
    };

    const unwire = listenForTooltips({ document, window }, { move: onMove, over: onOver, hide });
    return () => {
      clearTimeout(timer.current);
      unwire();
    };
  }, []);

  const host = tip?.host;
  useEffect(() => {
    if (!host) return;
    const follow = (): void => setTip((shown) => shown && followTip(shown, host.isConnected ? findTip(host) : null));
    const observer = new MutationObserver(follow);
    observer.observe(host, { attributes: true, attributeFilter: ['data-tip', 'data-tip-sub', 'data-tip-shortcut', 'data-state'] });
    // The element may leave with any of its ancestors.
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [host]);

  return tip && <TooltipBubble text={tip.text} sub={tip.sub} shortcut={tip.shortcut} pointerX={tip.pointerX} pointerY={tip.pointerY} />;
}

function findTip(target: Element | null): FoundTip | null {
  const host = target?.closest<HTMLElement>('[data-tip]');
  if (host) {
    const text = host.getAttribute('data-tip');
    // A menu or popover trigger that is open already shows what it does.
    if (!text || host.dataset.state === 'open' || (host.hasAttribute('data-tip-overflow') && !isClipped(host))) return null;
    return { text, sub: host.getAttribute('data-tip-sub') ?? undefined, shortcut: host.getAttribute('data-tip-shortcut') ?? undefined, host };
  }

  let element = target instanceof HTMLElement ? target : null;
  for (let depth = 0; element && depth < CLIPPED_SEARCH_DEPTH; depth++, element = element.parentElement) {
    if (element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).textOverflow === 'ellipsis') {
      const text = element.textContent?.trim();
      return text ? { text, host: element } : null;
    }
  }
  return null;
}

/** True when the element's text is clipped, or any descendant's is. */
function isClipped(element: HTMLElement): boolean {
  if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) return true;
  return [...element.querySelectorAll('*')].some((child) => child.scrollWidth > child.clientWidth + 1);
}
