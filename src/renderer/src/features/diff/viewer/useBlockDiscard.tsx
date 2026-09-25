import { parseDiffFromFile, type FileContents } from '@pierre/diffs';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createStore } from 'zustand/vanilla';
import { matchesShortcut } from '../../../lib/shortcuts';
import { lineDiffOptions, type ComparisonMethod } from './comparisonMethod';
import { listChangeBlocks, listChangeRegions, type ChangedLine, type DisplayMeta } from './changeBlocks';
import { DiscardChip, type HoveredLineStore } from './DiscardChip';
import { describeDiscard } from './discardAction';
import { discardLines } from './discardLines';
import { lineMarksCss, type LineMarks } from './lineMarksCss';
import { changedLinesInRange, regionRange, type LineRange } from './lineSelection';
import { PickedLinesBar } from './PickedLinesBar';
import { useShadowStyle } from './useShadowStyle';
import { hotkey } from '../../../lib/shortcutRegistry';

/** A discard ready to write: the file's new text and what was done, for the toast. */
export interface DiscardRequest {
  text: string;
  done: string;
}

interface BlockDiscardOptions {
  /** Off: the diff shows no actions (read-only, or being edited). */
  enabled: boolean;
  oldFile: FileContents;
  newFile: FileContents;
  /** How the diff shown compares lines, so the blocks are the ones on screen. */
  comparisonMethod: ComparisonMethod;
  layout: 'split' | 'unified';
  /** The scrolling element around the diff: its keys drive the actions, and it holds the diff's shadow root. */
  containerRef: RefObject<HTMLElement | null>;
  onDiscard?: (request: DiscardRequest) => void;
  onUndo?: () => void;
}

/** Lines picked in the gutter (with the mouse, or by moving to a change with the keyboard) and the changed lines among them. */
interface LinePick {
  meta: DisplayMeta;
  range: LineRange;
  lines: ChangedLine[];
}

type DiscardDiffOptions = Pick<
  FileDiffOptions<undefined, undefined>,
  'enableGutterUtility' | 'enableLineSelection' | 'lineHoverHighlight' | 'onLineSelected' | 'onLineEnter' | 'onLineLeave'
>;

/** The chip goes at the start of the line number cells (the middle seam, side by side), in room made before the numbers. */
const CHIP_PLACEMENT_CSS = '[data-column-number]{padding-inline-start:24px}[data-gutter-utility-slot]{left:0;right:auto;justify-content:flex-start;z-index:3}';

const LEAVE_MS = 120;
const RESTORED_MS = 900;

/**
 * Discarding changes from a workspace file's diff. Hovering a changed line offers, in its gutter, to discard its whole
 * change; picking lines by their numbers (click, drag, shift-click) narrows it to those lines, with a bar under them.
 * In the diff, ⌥↓/⌥↑ pick the next or previous change, ⌥⌘Z discards the picked lines, ⌘Z undoes the last discard and
 * Esc drops the pick.
 */
export function useBlockDiscard({ enabled, oldFile, newFile, comparisonMethod, layout, containerRef, onDiscard, onUndo }: BlockDiscardOptions) {
  // The same diff Pierre computes for display, so every block lines up with what is shown.
  const meta = useMemo(
    () => (enabled ? parseDiffFromFile(oldFile, newFile, lineDiffOptions(comparisonMethod)) : null),
    [enabled, oldFile, newFile, comparisonMethod],
  );
  const blocks = useMemo(() => (meta ? listChangeBlocks(meta) : []), [meta]);
  const regions = useMemo(() => listChangeRegions(blocks), [blocks]);
  const [hovered] = useState<HoveredLineStore>(() => createStore<ChangedLine | null>(() => null));
  const [pick, setPick] = useState<LinePick | null>(null);
  // A pick belongs to the text it was made on.
  const picked = pick && pick.meta === meta && pick.lines.length > 0 ? pick : null;
  const [marks, setMarks] = useState<LineMarks>({});
  const pickedSides = new Set(picked?.lines.map((line) => line.side));
  const pickedSide = layout === 'split' && pickedSides.size === 1 ? [...pickedSides][0] : undefined;
  useShadowStyle(containerRef, enabled ? `${CHIP_PLACEMENT_CSS}\n${lineMarksCss({ ...marks, pickedSide })}` : '');

  const latest = useRef({ blocks, layout, meta, pick });
  latest.current = { blocks, layout, meta, pick };

  const options = useMemo<DiscardDiffOptions>(
    () =>
      enabled
        ? {
            enableGutterUtility: true,
            enableLineSelection: true,
            lineHoverHighlight: 'number',
            onLineSelected: (range) => {
              const { blocks, layout, meta, pick } = latest.current;
              // Pierre echoes the pick it's given; a change picked with the keyboard keeps its exact lines.
              if (range && pick && isSameRange(range, pick.range)) return;
              setPick(range && meta ? { meta, range, lines: changedLinesInRange(blocks, range, layout) } : null);
            },
            onLineEnter: ({ lineType, annotationSide, lineNumber }) =>
              hovered.setState(lineType === 'change-addition' || lineType === 'change-deletion' ? { side: annotationSide, lineNumber } : null, true),
            onLineLeave: () => hovered.setState(null, true),
          }
        : {},
    [enabled, hovered],
  );

  const restoredTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(restoredTimer.current), []);
  // Lines on their way out can't be discarded again (a double click, a repeated key).
  const leaving = useRef(false);

  const discard = async (lines: ChangedLine[]): Promise<void> => {
    if (!meta || !onDiscard || lines.length === 0 || leaving.current) return;
    if (!prefersReducedMotion()) {
      leaving.current = true;
      setMarks({ leaving: lines });
      await new Promise((resolve) => setTimeout(resolve, LEAVE_MS));
      leaving.current = false;
    }
    const { text, restoredAt } = discardLines(meta, lines, comparisonMethod);
    setPick(null);
    // What was clicked goes with the lines: keep the diff's keys (⌘Z) working, and wait for the pointer to move.
    containerRef.current?.focus({ preventScroll: true });
    hovered.setState(null, true);
    setMarks({ restoredAt });
    onDiscard({ text, done: describeDiscard(lines).done });
    clearTimeout(restoredTimer.current);
    restoredTimer.current = setTimeout(() => setMarks({}), RESTORED_MS);
  };

  const moveToChange = (direction: 1 | -1): void => {
    if (regions.length === 0 || !meta) return;
    const current = picked ? regions.findIndex((region) => region.lines.some((line) => isSameLine(line, picked.lines[0]))) : -1;
    const next = current === -1 ? (direction === 1 ? 0 : regions.length - 1) : (current + direction + regions.length) % regions.length;
    const region = regions[next]!;
    setPick({ meta, range: regionRange(region), lines: region.lines });
    scrollToLine(containerRef.current, region.lines[0]!);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!enabled) return;
    const handlers: [string, () => void][] = [
      [hotkey('nextChange'), () => moveToChange(1)],
      [hotkey('previousChange'), () => moveToChange(-1)],
      [hotkey('discardLines'), () => void discard(picked?.lines ?? [])],
      [hotkey('undoDiscard'), () => onUndo?.()],
      [hotkey('clearPickedLines'), () => setPick(null)],
    ];
    const handler = handlers.find(([shortcut]) => matchesShortcut(event.nativeEvent, shortcut));
    if (!handler || (handler[0] === hotkey('clearPickedLines') && !picked)) return;
    event.preventDefault();
    handler[1]();
  };

  // Clicking a line number doesn't focus the diff by itself (Pierre holds on to the pointer), yet its keys should work.
  const onPointerDown = (): void => {
    if (enabled && !containerRef.current?.contains(document.activeElement)) containerRef.current?.focus({ preventScroll: true });
  };

  const preview = (lines: ChangedLine[] | null): void => setMarks(lines ? { preview: lines } : {});
  const actionable = enabled && Boolean(onDiscard);

  return {
    options,
    selectedLines: enabled ? (picked?.range ?? null) : undefined,
    // While lines are picked, their bar is the one action.
    renderGutterUtility: actionable
      ? (): ReactNode => !picked && <DiscardChip hovered={hovered} regions={regions} onPreview={preview} onDiscard={(lines) => void discard(lines)} />
      : undefined,
    overlay: actionable && picked && (
      <PickedLinesBar containerRef={containerRef} lines={picked.lines} onPreview={preview} onDiscard={(lines) => void discard(lines)} onClear={() => setPick(null)} />
    ),
    onKeyDown,
    onPointerDown,
  };
}

function isSameLine(a: ChangedLine, b: ChangedLine | undefined): boolean {
  return a.side === b?.side && a.lineNumber === b.lineNumber;
}

function isSameRange(a: LineRange, b: LineRange): boolean {
  return a.start === b.start && a.end === b.end && a.side === b.side && (a.endSide ?? a.side) === (b.endSide ?? b.side);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Brings a changed line to the middle of the view, unless it's already in sight. */
function scrollToLine(container: HTMLElement | null, { side, lineNumber }: ChangedLine): void {
  const type = side === 'deletions' ? 'change-deletion' : 'change-addition';
  const row = container?.querySelector('diffs-container')?.shadowRoot?.querySelector(`[data-line-type="${type}"][data-line="${lineNumber}"]`);
  if (!container || !row) return;
  const view = container.getBoundingClientRect();
  const { top, bottom } = row.getBoundingClientRect();
  if (top >= view.top && bottom <= view.bottom) return;
  row.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
