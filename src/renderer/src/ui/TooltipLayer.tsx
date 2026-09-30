import { useEffect, useRef, useState } from 'react';
import { followTip } from './followTip';
import { TooltipBubble } from './TooltipBubble';
import { listenForTooltips } from './tooltipEvents';
import { TooltipGate } from './tooltipGate';
import { findTip, type FoundTip } from './tooltipTarget';

interface Tip extends FoundTip {
  /** Pointer position at show time: the tip is anchored to the cursor. */
  pointerX: number;
  pointerY: number;
}

/** How long the pointer rests on something before its tooltip shows; canvas tooltips wait the same. */
export const TOOLTIP_SHOW_DELAY = 120;

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
  const gate = useRef(new TooltipGate());
  // Hiding only a tip that was shown: setting null again queues a React update on the layer, kept until it next
  // renders, for every key, press, scroll and move over the untipped (tens of thousands in a session).
  const shown = useRef(false);

  useEffect(() => {
    const hide = (): void => {
      clearTimeout(timer.current);
      if (!shown.current) return;
      shown.current = false;
      setTip(null);
    };
    const show = (found: FoundTip): void => {
      shown.current = true;
      setTip({ ...found, pointerX: pointer.current.x, pointerY: pointer.current.y });
    };
    const onMove = (event: MouseEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY };
      gate.current.pointerAt(event.clientX, event.clientY);
    };
    const onKey = (): void => gate.current.keyPressed();
    const onOver = (event: MouseEvent): void => {
      // Inside a shadow root (the diff viewers), the target is the host: look from the node really hovered first.
      const origin = event.composedPath()[0];
      const found = (origin instanceof Element && origin !== event.target ? findTip(origin) : null) ?? findTip(event.target as Element | null);
      if (!found || !gate.current.allowsHover) return hide();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => show(found), TOOLTIP_SHOW_DELAY);
    };

    const unwire = listenForTooltips({ document, window }, { move: onMove, over: onOver, hide });
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(timer.current);
      unwire();
      document.removeEventListener('keydown', onKey, true);
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
