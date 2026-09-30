import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * The table's width, followed as it resizes, for columns hidden below a width (`visibleColumns`). Only a table with
 * such columns (`observe`) watches it; the others stay `Infinity`, showing every column.
 */
export function useTableWidth(tableRef: RefObject<HTMLElement | null>, observe: boolean): number {
  const [width, setWidth] = useState(Infinity);
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || !observe) return;
    const observer = new ResizeObserver(() => setWidth(table.clientWidth));
    observer.observe(table);
    return () => observer.disconnect();
  }, [observe]);
  return width;
}
