import { useDetailsPaneStore } from './detailsPaneStore';

/** A details toggle on screen: the view or page it's in, by its details' key, and the element it was drawn in. */
export interface MountedDetailsToggle<Element = HTMLElement> {
  detailsKey: string;
  element: Element;
}

const mounted = new Set<MountedDetailsToggle>();

/**
 * Lets the "Show or hide details" command reach this toggle's view while it is in front; returns its removal.
 * Views stay mounted, hidden, under the pages opened over them (`PlaceLayout`), so being mounted isn't enough.
 */
export function registerDetailsToggle(toggle: MountedDetailsToggle): () => void {
  mounted.add(toggle);
  return () => mounted.delete(toggle);
}

/** The details' key of the view or page in front: the last toggle mounted among those `inFront` says are seen. */
export function detailsKeyInFront<Element>(toggles: Iterable<MountedDetailsToggle<Element>>, inFront: (element: Element) => boolean): string | undefined {
  return [...toggles].filter((toggle) => inFront(toggle.element)).at(-1)?.detailsKey;
}

/** Hides the details of the view or page in front, or shows them again; nothing when it has none. */
export function toggleDetailsInFront(): void {
  const detailsKey = detailsKeyInFront(mounted, isInFront);
  if (detailsKey !== undefined) useDetailsPaneStore.getState().toggleHidden(detailsKey);
}

function isInFront(element: HTMLElement): boolean {
  return element.isConnected && element.closest('[hidden]') === null;
}
