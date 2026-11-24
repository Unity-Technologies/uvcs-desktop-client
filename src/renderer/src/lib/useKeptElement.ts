import { useCallback, useState } from 'react';

/**
 * An element a callback ref gives, as state, for what is drawn into it or measures it (a portal's target, a
 * scroller). Kept while the ref says null: React detaches refs as an `Activity` hides what holds them (a view kept
 * mounted, `KeptView`), and an element dropped then would unmount what's drawn into it, its state with it. The element
 * goes with the component; a new one given takes its place.
 */
export function useKeptElement<T extends Element>(): [T | null, (element: T | null) => void] {
  const [element, setElement] = useState<T | null>(null);
  const keep = useCallback((next: T | null) => {
    if (next) setElement(next);
  }, []);
  return [element, keep];
}
