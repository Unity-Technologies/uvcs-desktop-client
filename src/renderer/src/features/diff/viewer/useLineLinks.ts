import type { SelectedLineRange } from '@pierre/diffs';
import type { FileDiffOptions } from '@pierre/diffs/react';
import { useContext, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { FocusedLines } from '../../../app/navigation/pages';
import { forgetSelectedLines, selectLines } from '../selectedLinesStore';
import type { ChangedLine } from './changeBlocks';
import { focusIn, LineLinksContext } from './lineLinks';
import { initialSelectedRange, publishedSelection } from './lineLinkMode';
import type { LineRange } from './lineSelection';

/** Scrolls the view in `container` to a line, as the view lays its lines out; returns a function that stops it. */
export type ScrollToLine = (container: HTMLElement, line: ChangedLine) => () => void;

interface LineLinksOptions {
  /** The file shown (its repository path, as `DiffEntry.path`): a view showing another file starts with none selected. */
  path: string;
  /** Lines can be selected in the gutter: off where it picks lines of its own (a workspace file's discards). */
  selectable: boolean;
  /** The view's scrolling element. */
  containerRef: RefObject<HTMLElement | null>;
  /** The view is on screen (its container rendered): it scrolls to a link's lines then. */
  shown: boolean;
  scrollTo: ScrollToLine;
}

type SelectionOptions = Pick<FileDiffOptions<undefined, undefined>, 'enableLineSelection' | 'lineHoverHighlight' | 'onLineSelectionChange' | 'onLineSelected'>;

/**
 * A view's lines for links (a diff, an annotated file): a click on a line's number selects it, Shift+click or a drag a
 * range of them, as on GitHub; those are the lines "Copy link" names where the place publishes them (`LineLinks`). A
 * file a link opened on scrolls to its lines, selected (`focusLines`, returned for a view that marks them its own way).
 */
export function useLineLinks({ path, selectable, containerRef, shown, scrollTo }: LineLinksOptions) {
  const lineLinks = useContext(LineLinksContext);
  const focusLines = focusIn(lineLinks, path);
  const [selection, setSelection] = useState<{ path: string; range: LineRange | null }>(() => ({ path, range: initialSelectedRange(selectable, focusLines) }));
  const range = selection.path === path ? selection.range : null;
  const latestPath = useRef(path);
  latestPath.current = path;
  const [select] = useState(() => (picked: SelectedLineRange | null): void => setSelection({ path: latestPath.current, range: picked }));

  const publishes = selectable && Boolean(lineLinks?.publishes);
  useEffect(() => {
    const published = publishedSelection(publishes, path, range);
    if (published !== undefined) selectLines(path, published?.lines ?? null);
  }, [publishes, path, range]);
  useEffect(() => (publishes ? () => forgetSelectedLines(path) : undefined), [publishes, path]);

  useScrollToFocus(shown ? focusLines : undefined, containerRef, scrollTo);

  const options = useMemo<SelectionOptions>(
    () => (selectable ? { enableLineSelection: true, lineHoverHighlight: 'number', onLineSelectionChange: select, onLineSelected: select } : {}),
    [selectable, select],
  );
  return { options, selectedLines: selectable ? range : undefined, focusLines };
}

/**
 * Scrolls to the lines a link opened the file on. Once: the place drops them as the user moves to another file
 * (`DiffBrowser`), so going back to it leaves it where the user is.
 */
function useScrollToFocus(focusLines: FocusedLines | undefined, containerRef: RefObject<HTMLElement | null>, scrollTo: ScrollToLine): void {
  const latestScrollTo = useRef(scrollTo);
  latestScrollTo.current = scrollTo;
  useEffect(() => {
    const container = containerRef.current;
    if (!focusLines || !container) return;
    return latestScrollTo.current(container, { side: focusLines.side === 'old' ? 'deletions' : 'additions', lineNumber: focusLines.first });
  }, [focusLines, containerRef]);
}
