import { parseDiffFromFile, type FileContents } from '@pierre/diffs';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { createStore } from 'zustand/vanilla';
import { matchesShortcut } from '../../../lib/shortcuts';
import { listChangeBlocks, listChangeRegions, type ChangedLine } from './changeBlocks';
import { DiscardChip, type HoveredLineStore } from './DiscardChip';
import { describeDiscard } from './discardAction';
import { discardLines } from './discardLines';
import { lineMarksCss, type LineMarks } from './lineMarksCss';
import { useShadowStyle } from './useShadowStyle';

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
  /** The scrolling element around the diff: its keys drive the actions, and it holds the diff's shadow root. */
  containerRef: RefObject<HTMLElement | null>;
  onDiscard?: (request: DiscardRequest) => void;
  onUndo?: () => void;
}

type DiscardDiffOptions = Pick<
  FileDiffOptions<undefined, undefined>,
  'enableGutterUtility' | 'lineHoverHighlight' | 'onLineEnter' | 'onLineLeave'
>;

/** The chip goes at the start of the line number cells (the middle seam, side by side), in room made before the numbers. */
const CHIP_PLACEMENT_CSS = '[data-column-number]{padding-inline-start:24px}[data-gutter-utility-slot]{left:0;right:auto;justify-content:flex-start;z-index:3}';

const LEAVE_MS = 120;
const RESTORED_MS = 900;

/**
 * Discarding changes from a workspace file's diff. Hovering a changed line offers, in its gutter, to discard its whole
 * change; ⌘Z in the diff undoes the last discard.
 */
export function useBlockDiscard({ enabled, oldFile, newFile, containerRef, onDiscard, onUndo }: BlockDiscardOptions) {
  // The same diff Pierre computes for display, so every block lines up with what is shown.
  const meta = useMemo(() => (enabled ? parseDiffFromFile(oldFile, newFile) : null), [enabled, oldFile, newFile]);
  const blocks = useMemo(() => (meta ? listChangeBlocks(meta) : []), [meta]);
  const regions = useMemo(() => listChangeRegions(blocks), [blocks]);
  const [hovered] = useState<HoveredLineStore>(() => createStore<ChangedLine | null>(() => null));
  const [marks, setMarks] = useState<LineMarks>({});
  useShadowStyle(containerRef, enabled ? `${CHIP_PLACEMENT_CSS}\n${lineMarksCss(marks)}` : '');

  const options = useMemo<DiscardDiffOptions>(
    () =>
      enabled
        ? {
            enableGutterUtility: true,
            lineHoverHighlight: 'number',
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
    const { text, restoredAt } = discardLines(meta, lines);
    // What was clicked goes with the lines: keep the diff's keys (⌘Z) working, and wait for the pointer to move.
    containerRef.current?.focus({ preventScroll: true });
    hovered.setState(null, true);
    setMarks({ restoredAt });
    onDiscard({ text, done: describeDiscard(lines).done });
    clearTimeout(restoredTimer.current);
    restoredTimer.current = setTimeout(() => setMarks({}), RESTORED_MS);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!enabled) return;
    if (!matchesShortcut(event.nativeEvent, 'mod+z')) return;
    event.preventDefault();
    onUndo?.();
  };

  // Clicking a line number doesn't focus the diff by itself, yet its keys should work.
  const onPointerDown = (): void => {
    if (enabled && !containerRef.current?.contains(document.activeElement)) containerRef.current?.focus({ preventScroll: true });
  };

  const preview = (lines: ChangedLine[] | null): void => setMarks(lines ? { preview: lines } : {});
  const actionable = enabled && Boolean(onDiscard);

  return {
    options,
    renderGutterUtility: actionable
      ? (): ReactNode => <DiscardChip hovered={hovered} regions={regions} onPreview={preview} onDiscard={(lines) => void discard(lines)} />
      : undefined,
    onKeyDown,
    onPointerDown,
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
