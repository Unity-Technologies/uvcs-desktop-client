import type { FocusedLines } from '../../../app/navigation/pages';
import { menuAction } from '../../../components/menuWords';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { hotkey } from '../../../lib/shortcutRegistry';
import type { ChangedLine } from './changeBlocks';
import type { ChangedLines, LineAction } from './diffAnnotations';
import { linesWords } from './lineActions';

interface LineMenuContext {
  /** The lines the menu acts on: those selected, the one right-clicked once selected. */
  lines: FocusedLines;
  /** Copies a link to them, where a link names them (`copyPageLink`). */
  copyLink?: () => void;
  copyLines: () => void;
  /** Opens the file annotated at them, where the code is a diff's whose newer side can be annotated. */
  annotate?: () => void;
  /** The place's own action on lines (a review's comment), on the lines selected (`lineActionTarget`). */
  lineAction?: LineAction;
}

/**
 * The entries of lines of code, in the code's right-click menu (`codeMenu`): what the place does with a line (a review
 * comments on it), who last changed them (the newer side's lines only: that's the revision annotated), a link to them,
 * and their text.
 */
export function lineMenuEntries({ lines, copyLink, copyLines, annotate, lineAction }: LineMenuContext): (GroupedEntry | false | undefined)[] {
  const one = lines.first === lines.last;
  const target = lineActionTarget(lines);
  return [
    lineAction?.offers(target) && menuAction('lineAction', () => lineAction.run(target), { label: lineAction.label(target) }),
    lineAction?.variant && lineAction.offers(target) && menuAction('lineActionVariant', () => lineAction.variant!.run(target), { label: lineAction.variant.label(target) }),
    annotate && lines.side === 'new' && menuAction('annotateLine', annotate, { label: one ? 'Annotate at this line' : 'Annotate at these lines' }),
    copyLink && menuAction('copyLineLink', copyLink, { label: `Copy link to ${linesWords(lines)}`, shortcut: hotkey('copyLink') }),
    menuAction('copyLines', copyLines, { label: one ? 'Copy line' : 'Copy lines' }),
  ];
}

/** The lines a place's action takes from lines selected: all of them, on their side. */
export function lineActionTarget(lines: FocusedLines): ChangedLines {
  return { side: lines.side === 'old' ? 'deletions' : 'additions', firstLineNumber: lines.first, lineNumber: lines.last };
}

/**
 * The lines the gutter's button acts on, by the line under the pointer: the lines selected when it's one of them, on
 * its side, as GitHub comments on a selection; that line alone otherwise.
 */
export function lineActionTargetAt(line: ChangedLine, selected: FocusedLines | null | undefined): ChangedLines {
  if (selected) {
    const range = lineActionTarget(selected);
    if (range.side === line.side && line.lineNumber >= range.firstLineNumber && line.lineNumber <= range.lineNumber) return range;
  }
  return { ...line, firstLineNumber: line.lineNumber };
}
