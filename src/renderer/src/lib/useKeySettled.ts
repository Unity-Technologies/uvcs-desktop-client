import { useEffect, useRef, useState } from 'react';
import { keySettle, type KeySettle } from './keySettle';
import { SELECTION_SETTLE_MS } from './useSettled';

/** Whether `key` has stayed shown for the whole of `delayMs` (`keySettle`): false again as soon as it changes. */
export function useKeySettled(key: string, delayMs = SELECTION_SETTLE_MS): boolean {
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const settle = useRef<KeySettle | null>(null);
  useEffect(() => {
    const current = keySettle(setSettledKey, delayMs);
    settle.current = current;
    return () => current.stop();
  }, [delayMs]);
  useEffect(() => settle.current?.show(key), [key, delayMs]);
  return settledKey === key;
}
