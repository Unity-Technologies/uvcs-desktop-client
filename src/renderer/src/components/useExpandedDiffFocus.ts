import { useContext } from 'react';
import { MAIN_FOCUS } from '../lib/mainFocus';
import { useDiffExpanded } from './diffExpansionStore';
import { ExpandableDiffContext } from './expandableDiffContext';

/**
 * Makes an expanded diff's code the window's main focus (`MAIN_FOCUS`) while its list is out of sight: focus that
 * falls to the page (a menu or dialog closed, the editor left with Esc) comes back to the code, not nowhere. Spread
 * the result on the element the code's keys go to.
 */
export function useExpandedDiffFocus(): typeof MAIN_FOCUS | undefined {
  const expandable = useContext(ExpandableDiffContext);
  const expanded = useDiffExpanded();
  return expandable && expanded ? MAIN_FOCUS : undefined;
}
