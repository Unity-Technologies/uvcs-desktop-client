import type { FocusedLines } from '../../../app/navigation/pages';
import { menuAction } from '../../../components/menuWords';
import type { GroupedEntry } from '../../../lib/menuGroups';
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
 * The entries of lines of code, in the code's right-click menu (`codeMenu`): who last changed them (the newer side's
 * lines only: that's the revision annotated), a link to them, and their text.
 */
export function lineMenuEntries({ lines, copyLink, copyLines, annotate }: LineMenuContext): (GroupedEntry | false | undefined)[] {
  const one = lines.first === lines.last;
  return [
    annotate && lines.side === 'new' && menuAction('annotateLine', annotate, { label: one ? 'Annotate at this line' : 'Annotate at these lines' }),
    copyLink && menuAction('copyLineLink', copyLink, { label: `Copy link to ${linesWords(lines)}`, shortcut: hotkey('copyLink') }),
    menuAction('copyLines', copyLines, { label: one ? 'Copy line' : 'Copy lines' }),
  ];
}
