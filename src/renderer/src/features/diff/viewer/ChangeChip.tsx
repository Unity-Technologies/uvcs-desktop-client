import { Undo2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { useStore } from 'zustand';
import { hotkey } from '../../../lib/shortcutRegistry';
import { Kbd } from '../../../ui/Kbd';
import { regionContaining, type ChangedLine, type ChangeRegion } from './changeBlocks';
import { describeDiscard, wholeChangeLabel } from './discardAction';
import type { HoveredLineStore } from './LineDiscardButton';
import styles from './ChangeChip.module.css';

interface ChangeChipProps {
  /** The scrolling element around the diff, which the chip is placed in. */
  containerRef: RefObject<HTMLElement | null>;
  regions: ChangeRegion[];
  hovered: HoveredLineStore;
  /** Lines picked in the gutter: the chip acts on them instead of the whole change. */
  picked: ChangedLine[] | null;
  layout: 'split' | 'unified';
  /** The lines the chip would discard while the pointer is on it, to preview the result. */
  onPreview: (lines: ChangedLine[] | null) => void;
  onDiscard: (lines: ChangedLine[]) => void;
}

/** Marks the chip, so pressing it doesn't count as pressing elsewhere in the diff (which drops the pick). */
export const CHANGE_CHIP_ATTRIBUTE = 'data-change-chip';

/** How long the chip stays once the pointer leaves its change, to be reached. */
const GRACE_MS = 250;
const CHIP_HEIGHT = 20;

/**
 * The header of a change: a chip on its top edge, over the code, while the pointer is on the change. It reverts the
 * whole change ("Revert change"), or, once lines are picked in the gutter, just those ("Restore 3 lines").
 */
export function ChangeChip({ containerRef, regions, hovered, picked, layout, onPreview, onDiscard }: ChangeChipProps) {
  const region = useHoveredRegion(hovered, regions);
  const [onChip, setOnChip] = useState(false);
  const [held, setHeld] = useState<ChangeRegion | undefined>(undefined);
  // What was hovered stays while the pointer makes its way to the chip.
  useEffect(() => {
    if (region || onChip) return setHeld(region ?? held);
    const timer = setTimeout(() => setHeld(undefined), GRACE_MS);
    return () => clearTimeout(timer);
  }, [region, onChip]);

  const shownRegion = picked ? regionContaining(regions, picked[0]!) : held && regions.includes(held) ? held : undefined;
  const lines = picked ?? shownRegion?.lines;
  const position = useChipPosition(containerRef, shownRegion, layout);
  if (!lines || !shownRegion || !position) return null;

  const action = describeDiscard(lines);
  return (
    <button
      type="button"
      {...{ [CHANGE_CHIP_ATTRIBUTE]: '' }}
      className={styles.chip}
      style={position}
      data-kind={action.kind}
      data-picked={picked ? '' : undefined}
      data-tip={action.description}
      data-tip-sub={picked ? 'Esc or a click elsewhere drops the picked lines' : 'Tip: click a line number to pick that line, Shift+click another to pick the lines between'}
      onPointerEnter={() => {
        setOnChip(true);
        onPreview(lines);
      }}
      onPointerLeave={() => {
        setOnChip(false);
        onPreview(null);
      }}
      onClick={() => onDiscard(lines)}
    >
      {action.kind === 'remove' ? <X size={12} strokeWidth={2.25} /> : <Undo2 size={12} strokeWidth={2.25} />}
      {picked ? action.label : wholeChangeLabel(lines)}
      {picked && <Kbd keys={hotkey('discardLines')} />}
    </button>
  );
}

function useHoveredRegion(hovered: HoveredLineStore, regions: ChangeRegion[]): ChangeRegion | undefined {
  const line = useStore(hovered);
  return line ? regionContaining(regions, line) : undefined;
}

/**
 * Where the chip goes, in the container's scrolled content: on the change's top edge, where its code starts (on the
 * modified side, side by side, unless it only removes lines), or on its bottom edge when nothing is above it.
 */
function useChipPosition(containerRef: RefObject<HTMLElement | null>, region: ChangeRegion | undefined, layout: 'split' | 'unified'): { top: number; left: number } | null {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const root = container?.querySelector('diffs-container')?.shadowRoot;
    if (!container || !root || !region) return setPosition(null);
    const place = (): void => {
      const lines = layout === 'split' && region.lines.some((line) => line.side === 'additions') ? region.lines.filter((line) => line.side === 'additions') : region.lines;
      const first = numberCell(root, lines[0]!, layout);
      const last = numberCell(root, lines.at(-1)!, layout);
      if (!first || !last) return setPosition(null);
      const view = container.getBoundingClientRect();
      const top = first.getBoundingClientRect().top - view.top + container.scrollTop;
      const above = top - CHIP_HEIGHT;
      setPosition({
        top: above >= 0 ? above : last.getBoundingClientRect().bottom - view.top + container.scrollTop,
        left: first.getBoundingClientRect().right - view.left + container.scrollLeft + 4,
      });
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(container);
    return () => resize.disconnect();
  }, [containerRef, region, layout]);

  return position;
}

function numberCell(root: ShadowRoot, { side, lineNumber }: ChangedLine, layout: 'split' | 'unified'): Element | null {
  const type = side === 'deletions' ? 'change-deletion' : 'change-addition';
  const scope = layout === 'split' ? `[data-${side}] ` : '';
  return root.querySelector(`${scope}[data-column-number="${lineNumber}"][data-line-type="${type}"]`);
}
