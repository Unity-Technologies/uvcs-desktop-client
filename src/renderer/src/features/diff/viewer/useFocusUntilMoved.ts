import { useState } from 'react';

/** What a page opened on, and the place it was shown in first. */
export interface PlaceFocus<T> {
  focus: T | null;
  /** The first place the page showed with the focus; unknown until it's read. */
  firstPlace?: string;
}

/**
 * The focus as the page shows `place` (the revision selected, the item, the file): the first place known keeps it
 * (it may be read after the page opens); any other drops it for good. Returns the same state when nothing changes.
 */
export function focusOnPlace<T>(state: PlaceFocus<T>, place: string | undefined): PlaceFocus<T> {
  if (place === undefined || state.focus === null) return state;
  if (state.firstPlace === undefined) return { ...state, firstPlace: place };
  return place === state.firstPlace ? state : { focus: null };
}

/**
 * What a page opened on (a link's lines) while it shows the place it opened on (`focusOnPlace`): moving elsewhere
 * drops it, so coming back leaves the place as the user left it.
 */
export function useFocusUntilMoved<T>(initial: T | null, place: string | undefined): T | null {
  const [state, setState] = useState<PlaceFocus<T>>(() => ({ focus: initial }));
  const next = focusOnPlace(state, place);
  // Adjusted while rendering, as React allows for state derived from props: no frame shows the focus on another place.
  if (next !== state) setState(next);
  return next.focus;
}
