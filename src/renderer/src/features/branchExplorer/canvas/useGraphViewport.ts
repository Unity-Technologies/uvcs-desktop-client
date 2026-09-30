import { useEffect, useRef, useState } from 'react';
import { browserFrameClock } from './frameClock';
import { createGraphViewport, type GraphViewport } from './graphViewport';
import type { Size } from './viewport';

export type { GraphViewport } from './graphViewport';

/** The canvas viewport (`createGraphViewport`) for as long as the canvas shows, on the browser's frames. */
export function useGraphViewport(contentSize: () => Size, screenSize: () => Size, onChange: () => void): GraphViewport {
  const latest = useRef({ contentSize, screenSize, onChange });
  latest.current = { contentSize, screenSize, onChange };

  const [viewport] = useState(() =>
    createGraphViewport(
      {
        contentSize: () => latest.current.contentSize(),
        screenSize: () => latest.current.screenSize(),
        onChange: () => latest.current.onChange(),
      },
      browserFrameClock,
    ),
  );

  useEffect(() => viewport.stop, [viewport]);
  return viewport;
}
