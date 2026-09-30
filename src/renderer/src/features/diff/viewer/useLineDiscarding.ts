import { useEffect, useRef, useState, type RefObject } from 'react';
import { prefersReducedMotion } from '../../../lib/reducedMotion';
import type { ChangedLine, DisplayMeta } from './changeBlocks';
import type { ComparisonMethod } from './comparisonMethod';
import { describeDiscard } from './discardAction';
import { discardLines, withOwnLines } from './discardLines';
import type { HoveredLineStore } from './LineDiscardButton';
import type { LineMarks } from './lineMarksCss';
import { hoverUnderPointer } from './pierreDom';

/** A discard ready to write: the file's new text and what was done, for the toast. */
export interface DiscardRequest {
  text: string;
  done: string;
}

/** How long discarded lines take to fade out before they go. */
const LEAVE_MS = 120;
/** How long the lines a discard brought back stay lit. */
const RESTORED_MS = 900;
/**
 * After a discard, the next line slides under the pointer and its button shows, to click again. Clicks this soon after
 * one discard or the button showing are the rest of a double click, not a new discard.
 */
const REPEAT_MS = 150;

interface LineDiscardingOptions {
  /** The diff shown, null while it offers no discards. */
  meta: DisplayMeta | null;
  /** Both texts of `meta` with their own line breaks, which the discarded text keeps. */
  texts: { original: string; modified: string };
  /** The modified text as typed, ahead of `texts.modified` until a big text is diffed again: nothing is discarded meanwhile. */
  typed: string;
  /** How the diff compares lines: the line breaks lines come back with depend on it. */
  comparisonMethod: ComparisonMethod;
  containerRef: RefObject<HTMLElement | null>;
  hovered: HoveredLineStore;
  /** The pointer's last place over the diff, to hover what slides under it after a discard. */
  pointer: RefObject<{ x: number; y: number } | null>;
  /** The picked lines are gone with the discard. */
  dropPick: () => void;
  onDiscard?: (request: DiscardRequest) => void;
}

export interface LineDiscarding {
  /** The lines to call out: previewed, leaving, just restored (`lineMarksCss`). */
  marks: LineMarks;
  /** Shows what discarding these lines would do, while the pointer is on a button; null stops. */
  preview: (lines: ChangedLine[] | null) => void;
  /** Discards the lines: they fade out, the text without them is handed to `onDiscard`, and what came back lights up. */
  discard: (lines: ChangedLine[]) => Promise<void>;
  /** A button's click: `discard`, unless it's the rest of a double click on the line before. */
  discardClicked: (lines: ChangedLine[]) => void;
}

/** Discarding lines from a diff, one line, a change or the picked lines at a time (`useBlockDiscard`). */
export function useLineDiscarding({ meta, texts, typed, comparisonMethod, containerRef, hovered, pointer, dropPick, onDiscard }: LineDiscardingOptions): LineDiscarding {
  const [marks, setMarks] = useState<LineMarks>({});
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
  }, [meta, containerRef, pointer]);

  const discard = async (lines: ChangedLine[]): Promise<void> => {
    if (!meta || !onDiscard || lines.length === 0 || leaving.current || typed !== texts.modified) return;
    if (!prefersReducedMotion()) {
      leaving.current = true;
      setMarks({ leaving: lines });
      await new Promise((resolve) => setTimeout(resolve, LEAVE_MS));
      leaving.current = false;
    }
    const { text, restoredAt } = discardLines(withOwnLines(meta, texts.original, texts.modified), lines, comparisonMethod);
    dropPick();
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

  return {
    marks,
    preview: (lines) => setMarks(lines ? { preview: lines } : {}),
    discard,
    discardClicked: (lines) => {
      if (performance.now() - lastDiscardAt.current >= REPEAT_MS) void discard(lines);
    },
  };
}
