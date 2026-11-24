import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { focusAs } from '../../../lib/focusRing';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkey } from '../../../lib/shortcutRegistry';
import type { ChangedLine, DiffSide } from './changeBlocks';
import {
  findInText,
  findOpening,
  findBarRight,
  firstMatchFrom,
  matchCountWords,
  matchMarks,
  rowNeedsScroll,
  shownMatchMarks,
  sidewaysScrollBy,
  sideToFind,
  steppedMatch,
  type CodeMatch,
  MAX_MATCHES,
  type FindOptions,
  type TextPlace,
} from './codeFind';
import { lineUnderPointer } from './lineActions';
import { paneRect, pierreShadowRoot, rowTextRange, rowUnderPointer, sideLineRowSelector } from './pierreDom';
import { useDiffShadowRoot } from './useDiffShadowRoot';
import { useWordMarks, type WordMarkColors } from './useWordMarks';
import { closePierreSearchPanel, pierreSearchPanelIn } from './pierreSearchPanel';

interface CodeFindOptions {
  /** The scrolling element around the diff. */
  containerRef: RefObject<HTMLElement | null>;
  /** Each side's text as shown. */
  textOf: (side: DiffSide) => string;
  /** The one side the diff shows alone; null for two. */
  onlySide: DiffSide | null;
  /** The newer side is typed into: Find there is the editor's own search panel. */
  typedInto: boolean;
  /** Opens the editor's search panel in the text typed into (`openPierreSearchPanel`). */
  openEditorSearch: () => void;
  /** Scrolls the diff to a line, unfolding the region that holds it (`scrollToShownLine`). */
  scrollTo: (container: HTMLElement, line: ChangedLine) => void;
}

/** What `CodeFindBar` shows and does. */
export interface CodeFindBarModel {
  inputRef: RefObject<HTMLInputElement | null>;
  /** Pixels from the right of the diff's frame, at the top right of the side searched (`findBarRight`); null at the diff's. */
  right: number | null;
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
 * Finding text in a diff's read-only side (docs/features/diff.md, "Find in the code"). ⌘F in the diff, or Find in its
 * menu, opens the bar on the side last pressed, from the line pressed, or the editor's search panel where that side is
 * typed into (`findOpening`). Every decision is `codeFind`'s; this holds the
 * bar's state, marks the matches on the rows on screen (`useWordMarks`, every line's row: `sideLineRowSelector`) and
 * brings the match shown into view.
 */
export function useCodeFind({ containerRef, textOf, onlySide, typedInto, openEditorSearch, scrollTo }: CodeFindOptions) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<DiffSide>(sideToFind(onlySide, null));
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<FindOptions>({ matchCase: false, wholeWord: false, regex: false });
  const [right, setRight] = useState<number | null>(null);
  // Where the search goes from: the line pressed as it opened, then the match stepped to.
  const [from, setFrom] = useState<TextPlace | null>(null);
  // The line pressed as it opened: past `MAX_MATCHES`, the matches kept are those around it.
  const [startLine, setStartLine] = useState(1);
  const pressed = useRef<ChangedLine | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const latest = useRef({ scrollTo, openEditorSearch });
  latest.current = { scrollTo, openEditorSearch };

  const shownSide = onlySide ?? side;
  const text = textOf(shownSide);
  const found = useMemo(
    () => (open ? findInText(text, query, options, MAX_MATCHES, startLine) : { matches: NO_MATCHES, capped: false }),
    [open, text, query, options, startLine],
  );
  const current = firstMatchFrom(found.matches, from);
  const shownMatch = current === null ? null : found.matches[current]!;
  // Every match's marks once per search; a step changes only the shown one's, drawn over them.
  const allMarks = useMemo(() => matchMarks(shownSide, found.matches), [shownSide, found.matches]);
  const shownMarks = useMemo(() => shownMatchMarks(shownSide, shownMatch), [shownSide, shownMatch]);

  const root = useDiffShadowRoot(containerRef);
  useWordMarks(containerRef, root, allMarks, OTHER_MATCHES, sideLineRowSelector);
  useWordMarks(containerRef, root, shownMarks, SHOWN_MATCH, sideLineRowSelector);

  // While the bar is open: it stands over its side's pane as the diff is laid out anew (split or unified, a resize),
  // and it closes when Pierre's search panel opens in the text typed into (⌘F there), so the diff shows one search.
  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container || !root) return;
    const follow = (): void => {
      if (pierreSearchPanelIn(container)) return setOpen(false);
      setRight(barRight(container, root, shownSide));
    };
    follow();
    const mutations = new MutationObserver(follow);
    mutations.observe(root, { childList: true, subtree: true });
    const resizes = new ResizeObserver(follow);
    resizes.observe(container);
    return () => {
      mutations.disconnect();
      resizes.disconnect();
    };
  }, [open, root, shownSide]);

  const matchKey = shownMatch && `${shownSide}:${shownMatch.line}:${shownMatch.start}:${shownMatch.end}`;
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !shownMatch) return;
    bringIntoView(container, shownSide, shownMatch, latest.current.scrollTo);
    // Only when another match shows: what's on screen moving (typing elsewhere, a scroll) doesn't bring it back.
  }, [matchKey]);

  /** Opens Find on `on` (a side right-clicked), else the side last pressed: the bar, or the editor's panel (`findOpening`). */
  const openFind = (on?: DiffSide): void => {
    const opening = findOpening(onlySide, typedInto, pressed.current, on);
    if (opening.kind === 'editor') {
      setOpen(false);
      return latest.current.openEditorSearch();
    }
    closePierreSearchPanel(containerRef.current);
    setSide(opening.side);
    setFrom(opening.from);
    setStartLine(opening.from?.line ?? 1);
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
        right,
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

/** Where the bar stands over the pane of `side` (`findBarRight`), measured in the diff as it's laid out now. */
function barRight(container: HTMLElement, root: ShadowRoot, side: DiffSide): number | null {
  const pane = root.querySelector(side === 'deletions' ? '[data-deletions]' : '[data-additions]');
  const frame = (container.parentElement ?? container).getBoundingClientRect();
  const paneBox = pane && paneRect(pane);
  return findBarRight(paneBox ? { start: paneBox.left, end: paneBox.right } : null, { start: frame.left, end: frame.right });
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
