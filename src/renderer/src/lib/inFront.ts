/**
 * Whether an element is in the view or page in front: on the page and under nothing hidden. Views stay mounted,
 * hidden, under the pages opened over them (`PlaceLayout`), and stowed panes too (`SplitPane`'s `stowed`), so being
 * mounted isn't enough for a command to reach what an element stands for.
 */
export function isInFront(element: Pick<Element, 'isConnected' | 'closest'>): boolean {
  return element.isConnected && element.closest('[hidden]') === null;
}
