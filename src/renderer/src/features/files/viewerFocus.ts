/**
 * What the keyboard reads a file's content with: the element of the viewer that scrolls it (the diff, the annotated
 * text), so arrows and Page Down scroll it; the viewer itself while nothing scrolls.
 */
export function viewerFocusTarget(viewer: HTMLElement): HTMLElement {
  for (const element of viewer.querySelectorAll<HTMLElement>('*')) {
    if (element.scrollHeight > element.clientHeight && ['auto', 'scroll'].includes(getComputedStyle(element).overflowY)) {
      if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
      element.dataset.viewerFocus = '';
      return element;
    }
  }
  return viewer;
}
