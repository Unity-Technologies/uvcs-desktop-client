import { useContext, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import type { FocusedLines } from '../../../app/navigation/pages';
import { usePageLineLink } from '../../../app/links/usePageLineLink';
import { copyLinkLabel } from '../../../app/links/shownLink';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { hotkey } from '../../../lib/shortcutRegistry';
import { copyToClipboard } from '../../../ui/copyToClipboard';
import { contextMenuSelection, copiedLinesWord, lineChipAnchor, linesText, lineUnderPointer, type CodeLayout } from './lineActions';
import { LineLinkChip } from './LineLinkChip';
import { LineLinksContext } from './lineLinks';
import { linkedLinesOf } from './linkedLines';
import { lineMenuEntries } from './lineMenu';
import type { LineRange } from './lineSelection';
import { rowUnderPointer } from './pierreDom';

interface LineToolsOptions {
  /** The scrolling element around the code. */
  containerRef: RefObject<HTMLElement | null>;
  layout: CodeLayout;
  /** The lines selected and how to select others (`useLineLinks`). */
  range: LineRange | null;
  select: (range: LineRange | null) => void;
  /** Lines are selected here: off where the gutter picks lines to discard them (a workspace file's diff). */
  selectable: boolean;
  /** The place publishes the lines selected for links (`LineLinks`). */
  publishes: boolean;
  /** The text of a side, to copy lines from it. */
  textOf: (side: FocusedLines['side']) => string;
}

/**
 * What the lines selected offer: the "Copy link" chip by them, where a link names them, and the lines' entries in the
 * code's right-click menu (`lineMenuEntries`, joined by `useCodeMenu`), the right-click first selecting the line
 * clicked when it isn't selected.
 */
export function useLineTools({ containerRef, layout, range, select, selectable, publishes, textOf }: LineToolsOptions): {
  chip: ReactNode;
  menu: { enabled: boolean; pickLines: (event: MouseEvent) => FocusedLines | null; lineEntries: () => (GroupedEntry | false | undefined)[] };
} {
  const lineLinks = useContext(LineLinksContext);
  const annotateAt = lineLinks?.annotateAt;
  const link = usePageLineLink(publishes, lineLinks?.linkOf, linkedLinesOf(range));
  const linkable = link.target !== null;
  const anchor = lineChipAnchor(range, linkable);
  const menuLines = useRef<FocusedLines | null>(null);

  /** Selects the line right-clicked when it isn't selected; the lines the menu acts on, none off any line with none selected. */
  const pickLines = (event: MouseEvent): FocusedLines | null => {
    const row = rowUnderPointer(event.nativeEvent.composedPath());
    const clicked = row && lineUnderPointer(row);
    const selection = contextMenuSelection(range, clicked);
    menuLines.current = linkedLinesOf(selection);
    if (selection && selection !== range) select(selection);
    return menuLines.current;
  };

  /** The entries of the lines picked, for the code's menu (`codeMenu`); none off any line with none selected. */
  const lineEntries = (): (GroupedEntry | false | undefined)[] => {
    const lines = menuLines.current;
    if (!lines) return [];
    return lineMenuEntries({
      lines,
      copyLink: linkable ? link.copy : undefined,
      copyLines: () => copyToClipboard(linesText(textOf(lines.side), lines), copiedLinesWord(lines)),
      annotate: annotateAt && (() => annotateAt(lines)),
    });
  };

  const chip = anchor && (
    <LineLinkChip containerRef={containerRef} line={anchor} layout={layout} label={copyLinkLabel(link.target)} shortcut={hotkey('copyLink')} onCopy={link.copy} />
  );
  return { chip, menu: { enabled: selectable, pickLines, lineEntries } };
}
