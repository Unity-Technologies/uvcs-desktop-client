import type { FocusedLines } from '../../../app/navigation/pages';
import { menuAction } from '../../../components/menuWords';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { hotkey } from '../../../lib/shortcutRegistry';
import type { ChangedLine } from './changeBlocks';
import type { LineAction } from './diffAnnotations';
import { linesWords } from './lineActions';

interface LineMenuContext {
  /** The lines the menu acts on: those selected, the one right-clicked once selected. */
  lines: FocusedLines;
  /** Copies a link to them, where a link names them (`copyPageLink`). */
  copyLink?: () => void;
  copyLines: () => void;
  /** Opens the file annotated at them, where the code is a diff's whose newer side can be annotated. */
  annotate?: () => void;
  /** The place's own action on a line (a review's comment), on the last of the lines (`lineActionTarget`). */
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

/**
 * The line a place's action takes from lines selected: the last, where a comment on a range is anchored (`cm` names one
 * line), the line number the selection shows nearest the code below it.
 */
export function lineActionTarget(lines: FocusedLines): ChangedLine {
  return { side: lines.side === 'old' ? 'deletions' : 'additions', lineNumber: lines.last };
}
