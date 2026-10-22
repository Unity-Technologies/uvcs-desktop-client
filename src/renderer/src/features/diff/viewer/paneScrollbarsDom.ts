/** The attribute that marks the bars `PaneScrollbars` keeps at the bottom of a view, for what measures them. */
export const PANE_SCROLLBARS_ATTRIBUTE = 'data-pane-scrollbars';

/** How much of the bottom of `container`'s view the bars cover: their thickness while they show, else 0. */
export function paneScrollbarsHeight(container: HTMLElement): number {
  return container.querySelector<HTMLElement>(`:scope > [${PANE_SCROLLBARS_ATTRIBUTE}]`)?.offsetHeight ?? 0;
}
