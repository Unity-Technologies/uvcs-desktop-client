import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatShortcut } from '../lib/shortcuts';
import { hotkey } from '../lib/shortcutRegistry';
import { Button } from '../ui/Button';
import { expandDiffWords } from './diffExpansion';
import { registerExpandableDiff, toggleDiffExpanded, useDiffExpanded } from './diffExpansionStore';

/**
 * Last in a diff's header: gives the diff the whole window (Expand Diff), and, pressed, gives the rest back. Its
 * tooltip says how to leave before the mode starts.
 */
export function ExpandDiffButton() {
  const expanded = useDiffExpanded();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => registerExpandableDiff({ element: ref.current! }), []);
  const words = expandDiffWords(expanded, formatShortcut(hotkey('collapseDiff')).join(''));
  return (
    <Button
      ref={ref}
      size="small"
      variant={expanded ? 'secondary' : 'ghost'}
      icon={expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      aria-label={words.label}
      aria-pressed={expanded}
      data-tip={words.label}
      data-tip-sub={words.hint}
      data-tip-shortcut={hotkey(expanded ? 'collapseDiff' : 'expandDiff')}
      onClick={toggleDiffExpanded}
    />
  );
}
