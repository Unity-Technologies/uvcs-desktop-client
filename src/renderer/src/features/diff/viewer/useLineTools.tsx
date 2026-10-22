import { useContext, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';
import type { FocusedLines } from '../../../app/navigation/pages';
import { usePageLineLink } from '../../../app/links/usePageLineLink';
import { copyLinkLabel } from '../../../app/links/shownLink';
import type { MenuEntry } from '../../../lib/actions';
import { hotkey } from '../../../lib/shortcutRegistry';
import { copyToClipboard } from '../../../ui/copyToClipboard';
import { lineChipAnchor, linesText, lineUnderPointer, rightClickSelection, type CodeLayout } from './lineActions';
import { LineLinkChip } from './LineLinkChip';
import { LineLinksContext } from './lineLinks';
import { linkedLinesOf } from './linkedLines';
import { lineMenu } from './lineMenu';
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
 * What the lines selected offer: the "Copy link" chip by them, where a link names them, and the lines' menu on a
 * right-click (`lineMenu`), which first selects the line clicked when it isn't selected.
 */
export function useLineTools({ containerRef, layout, range, select, selectable, publishes, textOf }: LineToolsOptions): {
  chip: ReactNode;
  menu: { enabled: boolean; onContextMenu: (event: MouseEvent) => void; entries: () => MenuEntry[] };
} {
  const annotateAt = useContext(LineLinksContext)?.annotateAt;
  const link = usePageLineLink(publishes);
  const linkable = link.target !== null;
  const anchor = lineChipAnchor(range, linkable);
  const menuLines = useRef<FocusedLines | null>(null);

  const onContextMenu = (event: MouseEvent): void => {
    const row = rowUnderPointer(event.nativeEvent.composedPath());
    const clicked = row && lineUnderPointer(row);
    const selection = clicked ? rightClickSelection(range, clicked) : range;
    menuLines.current = linkedLinesOf(selection);
    // Off any line, with none selected: no menu, not even the system's.
    if (!menuLines.current) return event.preventDefault();
    if (selection !== range) select(selection);
  };

  const entries = (): MenuEntry[] => {
    const lines = menuLines.current;
    if (!lines) return [];
    return lineMenu({
      lines,
      copyLink: linkable ? link.copy : undefined,
      copyLines: () => copyToClipboard(linesText(textOf(lines.side), lines), lines.first === lines.last ? 'Line' : 'Lines'),
      annotate: annotateAt && (() => annotateAt(lines)),
    });
  };

  const chip = anchor && (
    <LineLinkChip containerRef={containerRef} line={anchor} layout={layout} label={copyLinkLabel(link.target)} shortcut={hotkey('copyLink')} onCopy={link.copy} />
  );
  return { chip, menu: { enabled: selectable, onContextMenu, entries } };
}
