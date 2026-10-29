import { useEffect, useState } from 'react';
import { createTrailingDebounce } from './trailingDebounce';

/** `value`, once it has stopped changing for `delayMs` (`createTrailingDebounce`). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const [debounce] = useState(() => createTrailingDebounce<T>(setDebounced));

  useEffect(() => {
    debounce.push(value, delayMs);
    return () => debounce.stop();
  }, [debounce, value, delayMs]);

  return debounced;
}
