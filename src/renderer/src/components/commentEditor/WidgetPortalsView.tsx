import { memo, useLayoutEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetPortals } from './widgetPortals';

/**
 * The editor's widgets' React content (chips, images, tables), each in the element CodeMirror gave it. A component of
 * its own, memoized on the portals alone: a key typed re-renders the editor, never the hundreds of chips of a long
 * comment, which re-render only as widgets come and go (`WidgetPortals`).
 */
export const WidgetPortalsView = memo(function WidgetPortalsView({ portals, onDrawn }: { portals: WidgetPortals; onDrawn: () => void }) {
  const widgets = useSyncExternalStore(portals.subscribe, portals.portals);
  // What React drew in the widgets changes their size: the editor measures its lines again.
  useLayoutEffect(onDrawn, [widgets]);
  return widgets.map((widget) => createPortal(widget.node, widget.host, String(widget.key)));
});
