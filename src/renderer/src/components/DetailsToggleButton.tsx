import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { hotkey } from '../lib/shortcutRegistry';
import { IconButton } from '../ui/IconButton';
import { registerDetailsToggle } from './detailsInFront';
import { detailsHidden, useDetailsPaneStore } from './detailsPaneStore';

/**
 * Hides a view's details panel, or shows it again: last in the header of every view with details (ARCHITECTURE.md
 * "List and details"), over the panel it folds. Its key is the view's `ListWithDetails` `detailsKey`.
 */
export function DetailsToggleButton({ detailsKey }: { detailsKey: string }) {
  const hidden = useDetailsPaneStore((state) => detailsHidden(state, detailsKey));
  const toggleHidden = useDetailsPaneStore((state) => state.toggleHidden);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => registerDetailsToggle({ detailsKey, element: ref.current! }), [detailsKey]);
  return (
    <IconButton
      ref={ref}
      icon={hidden ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
      label={hidden ? 'Show details' : 'Hide details'}
      shortcut={hotkey('toggleDetails')}
      onClick={() => toggleHidden(detailsKey)}
    />
  );
}
