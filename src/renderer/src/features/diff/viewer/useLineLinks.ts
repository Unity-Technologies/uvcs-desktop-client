import type { SelectedLineRange } from '@pierre/diffs';
import { useContext, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { FocusedLines } from '../../../app/navigation/pages';
import { forgetSelectedLines, selectLines } from '../selectedLinesStore';
import type { ChangedLine } from './changeBlocks';
import { focusIn, LineLinksContext } from './lineLinks';
import { lineNumberHint } from './lineActions';
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

type SelectionCallback = (range: SelectedLineRange | null) => void;

/** Pierre's options for selecting lines and hinting how, the same for a diff (`FileDiff`) and a file (`File`). */
export interface LineSelectionOptions {
  enableLineSelection?: boolean;
  lineHoverHighlight?: 'number';
  onLineSelectionStart?: SelectionCallback;
  onLineSelectionChange?: SelectionCallback;
  onLineSelectionEnd?: SelectionCallback;
  onLineSelected?: SelectionCallback;
  onLineEnter?: (line: LineHover) => void;
  onLineLeave?: (line: LineHover) => void;
}

/** What Pierre says of a line the pointer enters or leaves, a diff's or a file's. */
interface LineHover {
  numberElement: HTMLElement;
  event: PointerEvent;
}

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

  const hint = useLineNumberHint();
  const options = useMemo<LineSelectionOptions>(
    () => (selectable ? { enableLineSelection: true, lineHoverHighlight: 'number', onLineSelectionChange: select, onLineSelected: select, ...hint } : {}),
    [selectable, select, hint],
  );
  return { options, selectedLines: selectable ? range : undefined, range: selectable ? range : null, select, publishes, focusLines };
}

/**
 * The hint on a line number while the pointer is on it (`lineNumberHint`), through the app's tooltip (`data-tip`, set
 * on Pierre's number cell as the pointer enters it, before the tooltip looks): none while a selection is dragged.
 */
function useLineNumberHint(): Pick<LineSelectionOptions, 'onLineEnter' | 'onLineLeave' | 'onLineSelectionStart' | 'onLineSelectionEnd'> {
  const [hint] = useState(() => {
    let selecting = false;
    let hinted: HTMLElement | null = null;
    const clear = (): void => {
      hinted?.removeAttribute('data-tip');
      hinted = null;
    };
    return {
      onLineEnter: ({ numberElement, event }: LineHover): void => {
        clear();
        const tip = lineNumberHint(selecting);
        // On the number only, not the line's code.
        if (!tip || !event.composedPath().includes(numberElement)) return;
        numberElement.setAttribute('data-tip', tip);
        hinted = numberElement;
        // Pierre says the pointer entered the line on its `pointermove`, after the `mouseover` the tooltip looks at:
        // it's told again, now that the number has its tip.
        numberElement.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, composed: true, clientX: event.clientX, clientY: event.clientY }));
      },
      onLineLeave: clear,
      onLineSelectionStart: (): void => {
        selecting = true;
        clear();
      },
      onLineSelectionEnd: (): void => {
        selecting = false;
      },
    };
  });
  return hint;
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
