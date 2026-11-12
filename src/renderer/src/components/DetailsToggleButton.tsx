import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { hotkey } from '../lib/shortcutRegistry';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Tooltip } from '../ui/Tooltip';
import { registerDetailsToggle } from './detailsInFront';
import { detailsHidden, useDetailsPaneStore } from './detailsPaneStore';

/**
 * Hides a view's details panel, or shows it again: last in the header of every view with details (ARCHITECTURE.md
 * "List and details"), over the panel it folds. Its key is the view's `ListWithDetails` `detailsKey`; `noun` names what
 * the panel holds where it isn't an object's details (a review's comments), and `icon` draws it then (a comment's
 * bubbles say more than a panel's edge), with `count` beside it, what the panel has waiting (comments still open).
 */
export function DetailsToggleButton({ detailsKey, noun = 'details', icon, count }: { detailsKey: string; noun?: string; icon?: ReactNode; count?: { value: number; label: string } }) {
  const hidden = useDetailsPaneStore((state) => detailsHidden(state, detailsKey));
  const toggleHidden = useDetailsPaneStore((state) => state.toggleHidden);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => registerDetailsToggle({ detailsKey, element: ref.current! }), [detailsKey]);
  const label = hidden ? `Show ${noun}` : `Hide ${noun}`;
  if (icon && count) {
    return (
      <Tooltip content={`${label} · ${count.label}`} shortcut={hotkey('toggleDetails')}>
        <Button ref={ref} variant="ghost" icon={icon} aria-label={`${label}, ${count.label}`} aria-pressed={!hidden} onClick={() => toggleHidden(detailsKey)}>
          {String(count.value)}
        </Button>
      </Tooltip>
    );
  }
  return (
    <IconButton
      ref={ref}
      icon={icon ?? (hidden ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />)}
      aria-pressed={icon ? !hidden : undefined}
      label={label}
      shortcut={hotkey('toggleDetails')}
      onClick={() => toggleHidden(detailsKey)}
    />
  );
}
