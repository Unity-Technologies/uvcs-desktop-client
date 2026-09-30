import { useEffect, useRef } from 'react';
import type { GraphCanvasHandle } from './canvas/graphCanvasHandle';
import type { GraphSelection } from './graphSelection';
import type { GraphLayout } from './model/layoutGraph';

/**
 * The first time the graph appears, bring the workspace (where the home badge is: `homeTarget`), or the latest
 * history, into view. Later layouts keep the user's place instead (`keepPlace`).
 */
export function useOpeningView(layout: GraphLayout | null, home: GraphSelection | null, canvasRef: React.RefObject<GraphCanvasHandle | null>): void {
  const opened = useRef(false);
  useEffect(() => {
    // An empty graph shows no canvas: the next one to show opens anew.
    if (!canvasRef.current) opened.current = false;
    if (opened.current || !layout || layout.columnCount === 0 || !canvasRef.current) return;
    opened.current = true;
    canvasRef.current.showOpeningView(home ?? { kind: 'changeset', id: layout.nodesByColumn.at(-1)!.changeset.id });
  }, [layout, home, canvasRef]);
}
