import { parseDiffFromFile, type FileContents, type SelectedLineRange } from '@pierre/diffs';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { createStore } from 'zustand/vanilla';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import { lineDiffOptions, type ComparisonMethod } from './comparisonMethod';
import { listChangeBlocks, listChangeRegions, sameRegions, type ChangedLine, type ChangeRegion, type DisplayMeta } from './changeBlocks';
import { CHANGE_CHIP_ATTRIBUTE, ChangeChip } from './ChangeChip';
import { describeDiscard } from './discardAction';
import { discardLines } from './discardLines';
import { LineDiscardButton, type HoveredLineStore } from './LineDiscardButton';
import { lineMarksCss, type LineMarks } from './lineMarksCss';
import { changedLinesInRange, linesRange, regionRange, type LineRange } from './lineSelection';
import { useShadowStyle } from './useShadowStyle';

/** A discard ready to write: the file's new text and what was done, for the toast. */
export interface DiscardRequest {
  text: string;
  done: string;
}

interface BlockDiscardOptions {
  /** Off: the diff shows no actions (read-only). */
  enabled: boolean;
  oldFile: FileContents;
  /** The modified text as it is now, unsaved edits included. */
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
  'enableGutterUtility' | 'enableLineSelection' | 'lineHoverHighlight' | 'onLineSelectionStart' | 'onLineSelectionChange' | 'onLineSelected' | 'onLineEnter' | 'onLineLeave'
>;

/**
 * Room before the line numbers for the line buttons, which go at the start of the number cells. Only changed lines
 * can be picked or discarded, so only their numbers look like they can be pressed.
 */
const GUTTER_CSS = [
  '[data-column-number]{padding-inline-start:24px}',
  '[data-gutter-utility-slot]{left:0;right:auto;justify-content:flex-start;z-index:3}',
  ':is([data-column-number],[data-gutter-buffer]):not([data-line-type^="change-"]){cursor:default}',
  '[data-column-number][data-hovered]:not([data-line-type^="change-"]){--diffs-computed-hovered-line-bg:var(--diffs-computed-editor-active-line-bg)}',
].join('\n');

const LEAVE_MS = 120;
const RESTORED_MS = 900;
/**
 * After a discard, the next line slides under the pointer and its button shows, to click again. Clicks this soon after
 * one discard or the button showing are the rest of a double click, not a new discard.
 */
const REPEAT_MS = 150;
/** How long typing has to pause for the change's chip to come back. */
const TYPING_IDLE_MS = 400;

/**
 * Discarding changes from a workspace file's diff. Hovering a changed line offers, in its gutter, to discard just that
 * line, and on the change's top edge, to discard the whole change. Picking lines by their numbers (click, Shift+click,
 * drag, all shown as they're picked) narrows the change's chip to those lines. In the diff, ⌥↓/⌥↑ pick the next or
 * previous change, ⌥⌘Z discards the picked lines, ⌘Z undoes the last discard and Esc (or a click elsewhere) drops the pick.
 */
export function useBlockDiscard({ enabled, oldFile, newFile, comparisonMethod, layout, containerRef, onDiscard, onUndo }: BlockDiscardOptions) {
  // The same diff Pierre computes for display, so every block lines up with what is shown.
  const meta = useMemo(
    () => (enabled ? parseDiffFromFile(oldFile, newFile, lineDiffOptions(comparisonMethod)) : null),
    [enabled, oldFile, newFile, comparisonMethod],
  );
  const blocks = useMemo(() => (meta ? listChangeBlocks(meta) : []), [meta]);
  // The same changes stay the same objects while typing within them, so their chip stays put.
  const lastRegions = useRef<ChangeRegion[]>([]);
  const regions = useMemo(() => {
    const listed = listChangeRegions(blocks);
    if (!sameRegions(listed, lastRegions.current)) lastRegions.current = listed;
    return lastRegions.current;
  }, [blocks]);
  const typing = useTyping(containerRef, newFile);
  const [hovered] = useState<HoveredLineStore>(() => createStore<ChangedLine | null>(() => null));
  const [pick, setPick] = useState<LinePick | null>(null);
  // Where the diff puts the gutter buttons (it moves the same one from line to line).
  const utilitySlot = useRef<Element | null>(null);
  // The pointer's last place over the diff, to find what's under it once the lines move without it.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  // A pick belongs to the text it was made on.
  const picked = pick && pick.meta === meta && pick.lines.length > 0 ? pick : null;
  const [marks, setMarks] = useState<LineMarks>({});
  const pickedSides = new Set(picked?.lines.map((line) => line.side));
  const pickedSide = layout === 'split' && pickedSides.size === 1 ? [...pickedSides][0] : undefined;
  useShadowStyle(containerRef, enabled ? `${GUTTER_CSS}\n${lineMarksCss({ ...marks, pickedSide })}` : '');

  const latest = useRef({ blocks, layout, meta, pick });
  latest.current = { blocks, layout, meta, pick };

  const options = useMemo<DiscardDiffOptions>(() => {
    if (!enabled) return {};
    // Picked lines show as they're picked (the diff only shows the pick it's given), trimmed to the changed lines.
    const pickRange = (range: SelectedLineRange | null): void => {
      const { blocks, layout, meta, pick } = latest.current;
      // Pierre echoes the pick it's given; a change picked with the keyboard keeps its exact lines.
      if (range && pick && isSameRange(range, pick.range)) return;
      const lines = range && meta ? changedLinesInRange(blocks, range, layout) : [];
      setPick(meta && lines.length > 0 ? { meta, range: linesRange(lines), lines } : null);
    };
    return {
      enableGutterUtility: true,
      enableLineSelection: true,
      lineHoverHighlight: 'number',
      onLineSelectionStart: pickRange,
      onLineSelectionChange: pickRange,
      onLineSelected: pickRange,
      onLineEnter: ({ lineType, annotationSide, lineNumber, numberElement }) => {
        const changed = lineType === 'change-addition' || lineType === 'change-deletion';
        if (changed) utilitySlot.current = keepUtilityOn(numberElement, utilitySlot.current);
        hovered.setState(changed ? { side: annotationSide, lineNumber } : null, true);
      },
      onLineLeave: () => hovered.setState(null, true),
    };
  }, [enabled, hovered]);

  // A click anywhere outside the diff drops the pick too.
  useEffect(() => {
    if (!picked) return;
    const dropOutside = (event: globalThis.PointerEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setPick(null);
    };
    document.addEventListener('pointerdown', dropOutside, true);
    return () => document.removeEventListener('pointerdown', dropOutside, true);
  }, [picked, containerRef]);

  const restoredTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(restoredTimer.current), []);
  // Lines on their way out can't be discarded again (a double click, a repeated key).
  const leaving = useRef(false);
  const lastDiscardAt = useRef(-Infinity);
  const hoverAgain = useRef(false);

  // The discarded lines are gone: the line now under the pointer is hovered, so a click there goes on discarding.
  useEffect(() => {
    if (!hoverAgain.current) return;
    hoverAgain.current = false;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        hoverUnderPointer(containerRef.current, pointer.current);
        lastDiscardAt.current = performance.now();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [meta, containerRef]);

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
    // What was clicked goes with the lines: keep the diff's keys (⌘Z) working.
    containerRef.current?.focus({ preventScroll: true });
    hovered.setState(null, true);
    lastDiscardAt.current = performance.now();
    hoverAgain.current = true;
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
    // Keys the editor took (⌘Z, ⌥↑/⌥↓ and Esc while typing) are its own.
    if (!enabled || event.defaultPrevented) return;
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

  /** Esc while typing drops the pick first, before the editor gets it. */
  const dropPickFirst = (event: KeyboardEvent): boolean => {
    if (!picked || !matchesShortcut(event.nativeEvent, hotkey('clearPickedLines'))) return false;
    setPick(null);
    return true;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!enabled) return;
    // Pressing anything but a line number or the change's chip drops the pick.
    const path = event.nativeEvent.composedPath();
    if (!path.some((node) => node instanceof Element && (node.hasAttribute('data-column-number') || node.hasAttribute(CHANGE_CHIP_ATTRIBUTE)))) setPick(null);
    // Clicking a line number doesn't focus the diff by itself (Pierre holds on to the pointer), yet its keys should work.
    // A click in the text is the editor's: it takes the focus there.
    const inText = path.some((node) => node instanceof HTMLElement && node.isContentEditable);
    if (!inText && !containerRef.current?.contains(document.activeElement)) containerRef.current?.focus({ preventScroll: true });
  };

  const onPointerMove = (event: PointerEvent): void => {
    pointer.current = { x: event.clientX, y: event.clientY };
    typing.stop();
  };
  const onPointerLeave = (): void => {
    pointer.current = null;
  };

  const preview = (lines: ChangedLine[] | null): void => setMarks(lines ? { preview: lines } : {});
  const discardClicked = (lines: ChangedLine[]): void => {
    if (performance.now() - lastDiscardAt.current >= REPEAT_MS) void discard(lines);
  };
  const actionable = enabled && Boolean(onDiscard);

  return {
    options,
    selectedLines: enabled ? (picked?.range ?? null) : undefined,
    renderGutterUtility: actionable ? (): ReactNode => <LineDiscardButton hovered={hovered} picked={picked?.lines ?? null} onPreview={preview} onDiscard={discardClicked} /> : undefined,
    overlay: actionable && !typing.active && (
      <ChangeChip
        containerRef={containerRef}
        regions={regions}
        hovered={hovered}
        picked={picked?.lines ?? null}
        layout={layout}
        onPreview={preview}
        onDiscard={discardClicked}
      />
    ),
    onKeyDown,
    dropPickFirst,
    onPointerDown,
    onPointerMove,
    onPointerLeave,
  };
}

/**
 * Whether the text is being typed into (it changed with the caret in it, a moment ago): the change's chip stays out of
 * the way meanwhile, as the lines move under it. Moving the pointer brings it back.
 */
function useTyping(containerRef: RefObject<HTMLElement | null>, text: FileContents): { active: boolean; stop: () => void } {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const focused = containerRef.current?.querySelector('diffs-container')?.shadowRoot?.activeElement;
    if (!(focused instanceof HTMLElement && focused.isContentEditable)) return setActive(false);
    setActive(true);
    const timer = setTimeout(() => setActive(false), TYPING_IDLE_MS);
    return () => clearTimeout(timer);
  }, [containerRef, text]);
  return { active, stop: () => setActive(false) };
}

/**
 * The diff keeps its gutter button on the last picked line while lines are picked; the button of a line hovered
 * outside the pick goes on that line instead.
 */
function keepUtilityOn(numberCell: HTMLElement, known: Element | null): Element | null {
  const slot = (numberCell.getRootNode() as ParentNode).querySelector('[data-gutter-utility-slot]') ?? known;
  if (slot && slot.parentElement !== numberCell) numberCell.append(slot);
  return slot;
}

/**
 * Hovers what is under the pointer anew, as if it had moved: the diff only follows the pointer, so lines sliding under
 * a still pointer would stay unhovered. It's told the pointer left first, as the line it knew may be gone or another.
 */
function hoverUnderPointer(container: HTMLElement | null, at: { x: number; y: number } | null): void {
  const root = container?.querySelector('diffs-container')?.shadowRoot;
  if (!root || !at) return;
  for (const pre of root.querySelectorAll('pre')) pre.dispatchEvent(new window.PointerEvent('pointerleave', { pointerType: 'mouse' }));
  root.elementFromPoint(at.x, at.y)?.dispatchEvent(new window.PointerEvent('pointermove', { pointerType: 'mouse', clientX: at.x, clientY: at.y, bubbles: true, composed: true }));
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
