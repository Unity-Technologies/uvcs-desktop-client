import { useEffect, useState } from 'react';

/** How long a selection has to stay put before its details ask `cm` for more. */
export const SELECTION_SETTLE_MS = 300;

/**
 * False until `delayMs` after the component mounts. Details panels are keyed by the selected object, so a query
 * enabled by this runs only once the user stops on a row, not for every row an arrow key passes through.
 */
export function useSettled(delayMs = SELECTION_SETTLE_MS): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return settled;
}
