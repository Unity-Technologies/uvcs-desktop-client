import type { FocusedLines } from '../../../app/navigation/pages';
import { menuAction } from '../../../components/menuWords';
import type { MenuEntry } from '../../../lib/actions';
import { groupedMenu } from '../../../lib/menuGroups';
import { hotkey } from '../../../lib/shortcutRegistry';
import { linesWords } from './lineActions';

interface LineMenuContext {
  /** The lines the menu acts on: those selected, the one right-clicked once selected. */
  lines: FocusedLines;
  /** Copies a link to them, where a link names them (`copyPageLink`). */
  copyLink?: () => void;
  copyLines: () => void;
  /** Opens the file annotated at them, where the code is a diff's whose newer side can be annotated. */
  annotate?: () => void;
}

/**
 * The menu of lines of code, on a right-click: who last changed them (the newer side's lines only: that's the
 * revision annotated), a link to them, and their text.
 */
export function lineMenu({ lines, copyLink, copyLines, annotate }: LineMenuContext): MenuEntry[] {
  const one = lines.first === lines.last;
  return groupedMenu([
    annotate && lines.side === 'new' && menuAction('annotateLine', annotate, { label: one ? 'Annotate at this line' : 'Annotate at these lines' }),
    copyLink && menuAction('copyLineLink', copyLink, { label: `Copy link to ${linesWords(lines)}`, shortcut: hotkey('copyLink') }),
    menuAction('copyLines', copyLines, { label: one ? 'Copy line' : 'Copy lines' }),
  ]);
}
