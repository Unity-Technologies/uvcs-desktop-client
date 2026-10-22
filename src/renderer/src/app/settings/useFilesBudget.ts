import { useCallback, useState } from 'react';
import { textMeasurer } from '../../lib/measureText';
import { DEFAULT_FILES_BUDGET, filesBudget } from './mergeToolRows';

/**
 * How many characters of file types Settings › Merge's files column holds now: a ref for a row's files cell, watched
 * as the pane resizes, its width read in the code font's characters (`filesBudget` decides).
 */
export function useFilesBudget(): [(element: HTMLElement | null) => void, number] {
  const [budget, setBudget] = useState(DEFAULT_FILES_BUDGET);
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const charWidth = textMeasurer(element)('0000000000') / 10;
    const observer = new ResizeObserver(([entry]) => entry && setBudget(filesBudget(entry.contentRect.width, charWidth)));
    observer.observe(element);
    // React 19 runs a ref's cleanup when the element goes.
    return () => observer.disconnect();
  }, []);
  return [ref, budget];
}
