import { useCallback, useState } from 'react';
import { textMeasurer } from '../../lib/measureText';
import { fitsWidth, GUESSED_FIT, type FitsColumn } from './mergeToolRows';

/**
 * Whether a row's file types fit Settings › Merge's files column now: a ref for a row's files cell, watched as the pane
 * resizes, the text measured as that cell draws it (the code font).
 */
export function useFilesFit(): [(element: HTMLElement | null) => void, FitsColumn] {
  const [fits, setFits] = useState<FitsColumn>(() => GUESSED_FIT);
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const widthOf = textMeasurer(element);
    const observer = new ResizeObserver(([entry]) => entry && setFits(() => fitsWidth(entry.contentRect.width, widthOf)));
    observer.observe(element);
    // React 19 runs a ref's cleanup when the element goes.
    return () => observer.disconnect();
  }, []);
  return [ref, fits];
}
