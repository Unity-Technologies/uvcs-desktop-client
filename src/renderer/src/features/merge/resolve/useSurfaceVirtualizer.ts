import { Virtualizer } from '@pierre/diffs';
import { useCallback, useRef, useState } from 'react';

/**
 * A Pierre `Virtualizer` on a text surface (the element that scrolls), so a file shown there renders only the lines in
 * view: files can be huge. `setSurface` is the surface's ref; `surfaceRef` reads it.
 */
export function useSurfaceVirtualizer() {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [virtualizer] = useState(() => new Virtualizer());
  const setSurface = useCallback(
    (element: HTMLDivElement | null) => {
      surfaceRef.current = element;
      if (element) virtualizer.setup(element);
      else virtualizer.cleanUp();
    },
    [virtualizer],
  );
  return { virtualizer, surfaceRef, setSurface };
}
