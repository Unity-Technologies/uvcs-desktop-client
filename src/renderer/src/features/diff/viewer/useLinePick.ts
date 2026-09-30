import type { SelectedLineRange } from '@pierre/diffs';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ChangeBlock, ChangedLine, ChangeRegion, DisplayMeta } from './changeBlocks';
import type { DiffLayout } from './diffPreferencesStore';
import { changedLinesInRange, linesRange, regionRange, sameLineRange, type LineRange } from './lineSelection';

/** Lines picked in the gutter (with the mouse, or by moving to a change) and the changed lines among them. */
interface LinePick {
  meta: DisplayMeta;
  range: LineRange;
  lines: ChangedLine[];
}

interface LinePickOptions {
  /** The diff shown, null while it offers no discards: a pick belongs to the diff it was made on. */
  meta: DisplayMeta | null;
  blocks: ChangeBlock[];
  layout: DiffLayout;
  /** The scrolling element around the diff: a click outside it drops the pick. */
  containerRef: RefObject<HTMLElement | null>;
}

export interface LinePicking {
  /** The pick on the diff shown, if any. */
  picked: LinePick | null;
  /** For Pierre's line selection callbacks (stable): picked lines show as they're picked, trimmed to the changed ones. */
  pickRange: (range: SelectedLineRange | null) => void;
  /** Picks a change moved to, so ⌥⌘Z discards it. */
  pickChange: (change: ChangeRegion) => void;
  drop: () => void;
}

/** The lines picked in a diff's gutter, which the change's chip and ⌥⌘Z act on (`useBlockDiscard`). */
export function useLinePick({ meta, blocks, layout, containerRef }: LinePickOptions): LinePicking {
  const [pick, setPick] = useState<LinePick | null>(null);
  const picked = pick && pick.meta === meta && pick.lines.length > 0 ? pick : null;

  const latest = useRef({ blocks, layout, meta, pick });
  latest.current = { blocks, layout, meta, pick };
  const [pickRange] = useState(() => (range: SelectedLineRange | null): void => {
    const { blocks, layout, meta, pick } = latest.current;
    // Pierre echoes the pick it's given; a change picked with the keyboard keeps its exact lines.
    if (range && pick && sameLineRange(range, pick.range)) return;
    const lines = range && meta ? changedLinesInRange(blocks, range, layout) : [];
    setPick(meta && lines.length > 0 ? { meta, range: linesRange(lines), lines } : null);
  });

  // A click anywhere outside the diff drops the pick too.
  useEffect(() => {
    if (!picked) return;
    const dropOutside = (event: PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setPick(null);
    };
    document.addEventListener('pointerdown', dropOutside, true);
    return () => document.removeEventListener('pointerdown', dropOutside, true);
  }, [picked, containerRef]);

  return {
    picked,
    pickRange,
    pickChange: (change) => {
      if (meta) setPick({ meta, range: regionRange(change), lines: change.lines });
    },
    drop: () => setPick(null),
  };
}
