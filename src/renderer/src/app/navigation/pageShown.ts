import { createContext, useContext } from 'react';

/**
 * Whether the page around is the one on screen. A merge in progress stays mounted while set aside (`MergeInProgress`);
 * what it does from the keyboard (its shortcuts, Back) waits until it shows again.
 */
export const PageShownContext = createContext(true);

export function usePageShown(): boolean {
  return useContext(PageShownContext);
}
