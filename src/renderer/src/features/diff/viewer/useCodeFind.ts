import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { focusAs } from '../../../lib/focusRing';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import type { ChangedLine, DiffSide } from './changeBlocks';
import {
  findInText,
  findPlaceholder,
  firstMatchFrom,
  matchCountWords,
  matchMarks,
  rowNeedsScroll,
  sidewaysScrollBy,
  sideToFind,
  steppedMatch,
  type CodeMatch,
  type FindOptions,
  type TextPlace,
} from './codeFind';
import { lineUnderPointer } from './lineActions';
import { paneRect, pierreShadowRoot, rowTextRange, rowUnderPointer, sideLineRowSelector } from './pierreDom';
import { useDiffShadowRoot } from './useDiffShadowRoot';
import { useWordMarks, type WordMarkColors } from './useWordMarks';

interface CodeFindOptions {
  /** The scrolling element around the diff. */
  containerRef: RefObject<HTMLElement | null>;
  /** Each side's text as shown. */
  textOf: (side: DiffSide) => string;
  /** The one side the diff shows alone; null for two. */
  onlySide: DiffSide | null;
  /** Scrolls the diff to a line, unfolding the region that holds it (`scrollToShownLine`). */
  scrollTo: (container: HTMLElement, line: ChangedLine) => void;
}

/** What `CodeFindBar` shows and does. */
export interface CodeFindBarModel {
  inputRef: RefObject<HTMLInputElement | null>;
  placeholder: string;
  query: string;
  setQuery: (query: string) => void;
  options: FindOptions;
  setOptions: (options: FindOptions) => void;
  countWords: string;
  hasMatches: boolean;
  step: (backwards: boolean) => void;
  close: () => void;
}

const OTHER_MATCHES: WordMarkColors = { deletions: 'var(--bg-match)', additions: 'var(--bg-match)' };
const SHOWN_MATCH: WordMarkColors = { deletions: 'var(--bg-match-current)', additions: 'var(--bg-match-current)' };
const NO_MATCHES: CodeMatch[] = [];

/**
 * Finding text in a diff's read-only side (docs/features/diff.md, "Find in the code"). ⌘F in
 * the diff, or Find in its menu, opens the bar on the side last pressed (`sideToFind`), from the line pressed; the
 * side typed into keeps Pierre's own search panel, which takes ⌘F first. Every decision is `codeFind`'s; this holds the
 * bar's state, marks the matches on the rows on screen (`useWordMarks`, every line's row: `sideLineRowSelector`) and
 * brings the match shown into view.
 */
export function useCodeFind({ containerRef, textOf, onlySide, scrollTo }: CodeFindOptions) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<DiffSide>(sideToFind(onlySide, null));
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<FindOptions>({ matchCase: false, wholeWord: false });
  // Where the search goes from: the line pressed as it opened, then the match stepped to.
  const [from, setFrom] = useState<TextPlace | null>(null);
  const pressed = useRef<ChangedLine | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latest = useRef({ scrollTo });
  latest.current = { scrollTo };

  const shownSide = onlySide ?? side;
  const text = textOf(shownSide);
  const found = useMemo(() => (open ? findInText(text, query, options) : { matches: NO_MATCHES, capped: false }), [open, text, query, options]);
  const current = firstMatchFrom(found.matches, from);
  const shownMatch = current === null ? null : found.matches[current]!;
  const marks = useMemo(() => matchMarks(shownSide, found.matches, current), [shownSide, found.matches, current]);

  const root = useDiffShadowRoot(containerRef);
  useWordMarks(containerRef, root, marks.others, OTHER_MATCHES, sideLineRowSelector);
  useWordMarks(containerRef, root, marks.current, SHOWN_MATCH, sideLineRowSelector);

  const matchKey = shownMatch && `${shownSide}:${shownMatch.line}:${shownMatch.start}:${shownMatch.end}`;
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shownMatch) return;
    bringIntoView(container, shownSide, shownMatch, latest.current.scrollTo);
    // Only when another match shows: what's on screen moving (typing elsewhere, a scroll) doesn't bring it back.
  }, [matchKey]);

  /** Opens the bar on `on` (a side right-clicked), else the side last pressed, from the line pressed there. */
  const openFind = (on?: DiffSide): void => {
    const target = sideToFind(onlySide, on ?? pressed.current?.side ?? null);
    const line = pressed.current?.side === target ? pressed.current.lineNumber : null;
    setSide(target);
    setFrom(line === null ? null : { line, character: 0 });
    setOpen(true);
    // The field is there once React shows the bar.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const close = (): void => {
    setOpen(false);
    const container = containerRef.current;
    if (container) focusAs(container, 'app');
  };

  const step = (backwards: boolean): void => {
    const next = steppedMatch(found.matches.length, current, backwards);
    if (next === null) return;
    const match = found.matches[next]!;
    setFrom({ line: match.line, character: match.start });
  };

  /** Remembers the row pressed: its side is the one ⌘F searches, from its line. */
  const onPointerDownCapture = (event: PointerEvent): void => {
    const row = rowUnderPointer(event.nativeEvent.composedPath());
    pressed.current = row && lineUnderPointer(row);
  };

  /** ⌘F in the diff, outside the text typed into (whose editor takes it first). */
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || !matchesShortcut(event.nativeEvent, hotkey('textFind'))) return;
    event.preventDefault();
    event.stopPropagation();
    openFind();
  };

  const bar: CodeFindBarModel | null = open
    ? {
        inputRef,
        placeholder: findPlaceholder(shownSide, onlySide),
        query,
        setQuery,
        options,
        setOptions,
        countWords: matchCountWords(query, current, found),
        hasMatches: found.matches.length > 0,
        step,
        close,
      }
    : null;

  return { bar, openFind, onKeyDown, onPointerDownCapture };
}

/**
 * Scrolls the match into view, only where it isn't already (`rowNeedsScroll`, `sidewaysScrollBy`): stepping through
 * matches on screen leaves the code still, and a long line scrolls sideways to its match. A row not drawn yet is
 * scrolled to through `scrollTo`, which unfolds a collapsed region.
 */
function bringIntoView(container: HTMLElement, side: DiffSide, match: CodeMatch, scrollTo: CodeFindOptions['scrollTo']): void {
  const row = pierreShadowRoot(container)?.querySelector(sideLineRowSelector({ side, lineNumber: match.line }));
  const view = container.getBoundingClientRect();
  const rowBox = row?.getBoundingClientRect();
  if (rowNeedsScroll(rowBox ? { start: rowBox.top, end: rowBox.bottom } : null, { start: view.top, end: view.bottom })) scrollTo(container, { side, lineNumber: match.line });
  const characters = row && rowTextRange(row, match.start, match.end)?.getBoundingClientRect();
  const pane = row?.closest('[data-code]');
  if (!characters || !(pane instanceof HTMLElement)) return;
  const paneBox = paneRect(pane);
  // The line numbers stay put at the pane's left as the code scrolls under them.
  const numbersEnd = pane.querySelector(':scope > [data-gutter]')?.getBoundingClientRect().right ?? paneBox.left;
  pane.scrollLeft += sidewaysScrollBy({ start: characters.left, end: characters.right }, { start: numbersEnd, end: paneBox.right });
}
