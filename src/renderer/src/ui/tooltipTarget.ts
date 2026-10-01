import type { TipText } from './followTip';
import { readTipAttributes } from './tipAttributes';

/** A tooltip found on the page, read from its attributes (`readTipAttributes`). */
export interface FoundTip extends TipText {
  /** The element the tip is read from: followed while it shows. */
  host: Element;
}

/** How far up from the hovered node to look for a label cut off with an ellipsis. */
const CLIPPED_SEARCH_DEPTH = 4;

/**
 * The tooltip of what the pointer is on: the closest `data-tip` (none while its menu or popover is open, or, with
 * `data-tip-overflow`, while its text shows whole), else the whole text of a label cut off by CSS `text-overflow:
 * ellipsis` a few levels up.
 */
export function findTip(target: Element | null): FoundTip | null {
  const host = target?.closest<HTMLElement>('[data-tip]');
  if (host) {
    const tip = readTipAttributes((name) => host.getAttribute(name));
    // A menu or popover trigger that is open already shows what it does.
    if (!tip || host.dataset.state === 'open' || (host.hasAttribute('data-tip-overflow') && !isClipped(host))) return null;
    return { ...tip, host };
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
