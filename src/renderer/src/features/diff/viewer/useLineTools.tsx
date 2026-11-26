import { useContext, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import type { FocusedLines } from '../../../app/navigation/pages';
import { usePageLineLink } from '../../../app/links/usePageLineLink';
import { copyLinkLabel } from '../../../app/links/shownLink';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { hotkey } from '../../../lib/shortcutRegistry';
import { copyToClipboard } from '../../../ui/copyToClipboard';
import { contextMenuLines, copiedLinesWord, lineChipAnchor, linesText, lineUnderPointer, type CodeLayout } from './lineActions';
import { LineLinkChip } from './LineLinkChip';
import { LineLinksContext } from './lineLinks';
import { linkedLinesOf } from './linkedLines';
import type { LineAction } from './diffAnnotations';
import { lineMenuEntries } from './lineMenu';
import type { LineRange } from './lineSelection';
import { rowUnderPointer } from './pierreDom';

interface LineToolsOptions {
  /** The scrolling element around the code. */
  containerRef: RefObject<HTMLElement | null>;
  /** The file shown (its repository path, as `DiffEntry.path`): a link to lines names it. */
  path: string;
  layout: CodeLayout;
  /** The lines selected (`useLineLinks`). */
  range: LineRange | null;
  /** Lines are selected here: off where the gutter picks lines to discard them (a workspace file's diff). */
  selectable: boolean;
  /** The place publishes the lines selected for links (`LineLinks`). */
  publishes: boolean;
  /** The text of a side, to copy lines from it. */
  textOf: (side: FocusedLines['side']) => string;
  /** The place's own action on a line (`DiffAnnotations.lineAction`), in the menu. */
  lineAction?: LineAction;
}

/**
 * What the lines selected offer: the "Copy link" chip by them, where a link names them, and the lines' entries in the
 * code's right-click menu (`lineMenuEntries`, joined by `useCodeMenu`), on the line right-clicked, or on the lines
 * selected when it's one of them. The right-click leaves the selection as it was: the menu names its lines.
 */
export function useLineTools({ containerRef, path, layout, range, selectable, publishes, textOf, lineAction }: LineToolsOptions): {
  chip: ReactNode;
  menu: { enabled: boolean; pickLines: (event: MouseEvent) => FocusedLines | null; lineEntries: () => (GroupedEntry | false | undefined)[] };
} {
  const lineLinks = useContext(LineLinksContext);
  const annotateAt = lineLinks?.annotateAt;
  const link = usePageLineLink(publishes, lineLinks?.linkOf, linkedLinesOf(range));
  const linkable = link.target !== null;
  const anchor = lineChipAnchor(range, linkable);
  const menuLines = useRef<FocusedLines | null>(null);
  const menuOnSelection = useRef(false);

  /** The lines the menu acts on, none off any line with none selected. */
  const pickLines = (event: MouseEvent): FocusedLines | null => {
    const row = rowUnderPointer(event.nativeEvent.composedPath());
    const clicked = row && lineUnderPointer(row);
    const lines = contextMenuLines(range, clicked);
    menuLines.current = linkedLinesOf(lines);
    menuOnSelection.current = lines !== null && lines === range;
    return menuLines.current;
  };

  /** The entries of the lines picked, for the code's menu (`codeMenu`); none off any line with none selected. */
  const lineEntries = (): (GroupedEntry | false | undefined)[] => {
    const lines = menuLines.current;
    if (!lines) return [];
    const onSelection = menuOnSelection.current;
    const linesLink = link.linkToLines(path, lines);
    return lineMenuEntries({
      lines,
      linesSelected: onSelection,
      // The lines selected copy as ⇧⌘C does, their toast teaching it; others copy their own link.
      copyLink: linesLink ? () => (onSelection ? link.copy() : link.copyLink(linesLink)) : undefined,
      copyLines: () => copyToClipboard(linesText(textOf(lines.side), lines), copiedLinesWord(lines)),
      annotate: annotateAt && (() => annotateAt(lines)),
      lineAction,
    });
  };

  const chip = anchor && (
    <LineLinkChip containerRef={containerRef} line={anchor} layout={layout} label={copyLinkLabel(link.target)} shortcut={hotkey('copyLink')} onCopy={link.copy} />
  );
  return { chip, menu: { enabled: selectable, pickLines, lineEntries } };
}
