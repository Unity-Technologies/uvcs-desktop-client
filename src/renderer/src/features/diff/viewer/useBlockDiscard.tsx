import type { FileDiffOptions } from '@pierre/diffs/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { createStore } from 'zustand/vanilla';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import { isChanged, listChangeBlocks, listChangeRegions, sameRegions, type ChangeBlock, type ChangedLine, type ChangeRegion, type DisplayMeta } from './changeBlocks';
import { CHANGE_CHIP_ATTRIBUTE, ChangeChip } from './ChangeChip';
import type { ComparisonMethod } from './comparisonMethod';
import type { DiffLayout } from './diffPreferencesStore';
import { LineDiscardButton, type HoveredLineStore } from './LineDiscardButton';
import { lineMarksCss } from './lineMarksCss';
import { moveGutterUtilityTo } from './pierreDom';
import { useLineDiscarding, type DiscardRequest } from './useLineDiscarding';
import { useLinePick } from './useLinePick';
import { useShadowStyle } from './useShadowStyle';
import { useTypingActivity } from './useTypingActivity';

interface BlockDiscardOptions {
  /** Off: the diff shows no actions (read-only). */
  enabled: boolean;
  /** The diff shown, of the original and the modified text as it is now, unsaved edits included (`lineDiff`). */
  diff: DisplayMeta;
  /** Both texts of `diff` with their own line breaks, which the discarded text keeps. */
  texts: { original: string; modified: string };
  /** The modified text as typed, ahead of `texts.modified` until a big text is diffed again: nothing is discarded meanwhile. */
  typed: string;
  /** How the diff compares lines: the line breaks lines come back with depend on it. */
  comparisonMethod: ComparisonMethod;
  layout: DiffLayout;
  /** The scrolling element around the diff: its keys drive the actions, and it holds the diff's shadow root. */
  containerRef: RefObject<HTMLElement | null>;
  onDiscard?: (request: DiscardRequest) => void;
  onUndo?: () => void;
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

/**
 * Discarding changes from a workspace file's diff. Hovering a changed line offers, in its gutter, to discard just that
 * line, and on the change's top edge, to discard the whole change. Picking lines by their numbers (click, Shift+click,
 * drag, all shown as they're picked: `useLinePick`) narrows the change's chip to those lines, and so does moving to a
 * change (the diff's navigation, `pickChange`). In the diff, ⌥⌘Z discards the picked lines, ⌘Z undoes the last discard
 * and Esc (or a click elsewhere) drops the pick. The discards themselves: `useLineDiscarding`.
 */
export function useBlockDiscard({ enabled, diff, texts, typed, comparisonMethod, layout, containerRef, onDiscard, onUndo }: BlockDiscardOptions) {
  // The diff on screen, so every block lines up with what is shown.
  const meta = enabled ? diff : null;
  const blocks = useMemo(() => (meta ? listChangeBlocks(meta) : []), [meta]);
  const regions = useStableRegions(blocks);
  const typing = useTypingActivity(containerRef, typed);
  const [hovered] = useState<HoveredLineStore>(() => createStore<ChangedLine | null>(() => null));
  const pick = useLinePick({ meta, blocks, layout, containerRef });
  const picked = pick.picked;
  // The pointer's last place over the diff, to find what's under it once the lines move without it.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const discarding = useLineDiscarding({ meta, texts, typed, comparisonMethod, containerRef, hovered, pointer, dropPick: pick.drop, onDiscard });

  const pickedSides = new Set(picked?.lines.map((line) => line.side));
  const pickedSide = layout === 'split' && pickedSides.size === 1 ? [...pickedSides][0] : undefined;
  useShadowStyle(containerRef, enabled ? `${GUTTER_CSS}\n${lineMarksCss({ ...discarding.marks, pickedSide })}` : '');

  const latestBlocks = useRef(blocks);
  latestBlocks.current = blocks;
  // Where the diff puts the gutter buttons (it moves the same one from line to line).
  const utilitySlot = useRef<Element | null>(null);
  const options = useMemo<DiscardDiffOptions>(() => {
    if (!enabled) return {};
    return {
      enableGutterUtility: true,
      enableLineSelection: true,
      lineHoverHighlight: 'number',
      onLineSelectionStart: pick.pickRange,
      onLineSelectionChange: pick.pickRange,
      onLineSelected: pick.pickRange,
      onLineEnter: ({ lineType, annotationSide, lineNumber, numberElement }) => {
        // Only lines the diff has as changed: Pierre recolors lines a moment after typing stops, and shows the editor's
        // empty last line as added after a change that removes more lines than it adds.
        const changed = (lineType === 'change-addition' || lineType === 'change-deletion') && isChanged(latestBlocks.current, { side: annotationSide, lineNumber });
        if (changed) utilitySlot.current = moveGutterUtilityTo(numberElement, utilitySlot.current);
        hovered.setState(changed ? { side: annotationSide, lineNumber } : null, true);
      },
      onLineLeave: () => hovered.setState(null, true),
    };
  }, [enabled, hovered, pick.pickRange]);

  // Typing moves lines under a still pointer: a line hovered before that may not be a changed line any more.
  useEffect(() => {
    const line = hovered.getState();
    if (line && !isChanged(blocks, line)) hovered.setState(null, true);
  }, [blocks, hovered]);

  const onKeyDown = (event: KeyboardEvent): void => {
    // Keys the editor took (⌘Z and Esc while typing) are its own.
    if (!enabled || event.defaultPrevented) return;
    const handlers: [string, () => void][] = [
      [hotkey('discardLines'), () => void discarding.discard(picked?.lines ?? [])],
      [hotkey('undoDiscard'), () => onUndo?.()],
      [hotkey('clearPickedLines'), pick.drop],
    ];
    const handler = handlers.find(([shortcut]) => matchesShortcut(event.nativeEvent, shortcut));
    if (!handler || (handler[0] === hotkey('clearPickedLines') && !picked)) return;
    event.preventDefault();
    handler[1]();
  };

  /** Esc while typing drops the pick first, before the editor gets it. */
  const dropPickFirst = (event: KeyboardEvent): boolean => {
    if (!picked || !matchesShortcut(event.nativeEvent, hotkey('clearPickedLines'))) return false;
    pick.drop();
    return true;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (!enabled) return;
    // Pressing anything but a line number or the change's chip drops the pick.
    const path = event.nativeEvent.composedPath();
    if (!path.some((node) => node instanceof Element && (node.hasAttribute('data-column-number') || node.hasAttribute(CHANGE_CHIP_ATTRIBUTE)))) pick.drop();
    // Clicking a line number doesn't focus the diff by itself (Pierre holds on to the pointer), yet its keys should work.
    // A click in the text is the editor's: it takes the focus there.
    const inText = path.some((node) => node instanceof HTMLElement && node.isContentEditable);
    if (!inText && !containerRef.current?.contains(document.activeElement)) containerRef.current?.focus({ preventScroll: true });
  };

  const actionable = enabled && Boolean(onDiscard);
  const pickedLines = picked?.lines ?? null;
  return {
    options,
    selectedLines: enabled ? (picked?.range ?? null) : undefined,
    renderGutterUtility: actionable
      ? (): ReactNode => <LineDiscardButton hovered={hovered} picked={pickedLines} onPreview={discarding.preview} onDiscard={discarding.discardClicked} />
      : undefined,
    overlay: actionable && !typing.active && (
      <ChangeChip
        containerRef={containerRef}
        regions={regions}
        hovered={hovered}
        picked={pickedLines}
        layout={layout}
        onPreview={discarding.preview}
        onDiscard={discarding.discardClicked}
      />
    ),
    onKeyDown,
    pickChange: pick.pickChange,
    dropPickFirst,
    onPointerDown,
    onPointerMove: (event: PointerEvent): void => {
      pointer.current = { x: event.clientX, y: event.clientY };
      typing.stop();
    },
    onPointerLeave: (): void => {
      pointer.current = null;
    },
  };
}

/** The diff's changes: the same objects while typing within them, so their chip stays put. */
function useStableRegions(blocks: ChangeBlock[]): ChangeRegion[] {
  const lastRegions = useRef<ChangeRegion[]>([]);
  return useMemo(() => {
    const listed = listChangeRegions(blocks);
    if (!sameRegions(listed, lastRegions.current)) lastRegions.current = listed;
    return lastRegions.current;
  }, [blocks]);
}
