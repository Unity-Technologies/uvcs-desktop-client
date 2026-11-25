import type { FocusedLines } from '../../../app/navigation/pages';
import { menuAction } from '../../../components/menuWords';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { hotkey } from '../../../lib/shortcutRegistry';
import type { ChangedLine } from './changeBlocks';
import type { ChangedLines, LineAction } from './diffAnnotations';
import { linesWords } from './lineActions';

interface LineMenuContext {
  /** The lines the menu acts on: those selected when right-clicked on one of them, else the one right-clicked. */
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
  const target = lineActionTarget(lines);
  return [
    lineAction?.offers(target) && menuAction('lineAction', () => lineAction.run(target), { label: lineAction.label(target) }),
    lineAction?.variant && lineAction.offers(target) && menuAction('lineActionVariant', () => lineAction.variant!.run(target), { label: lineAction.variant.label(target) }),
    annotate && lines.side === 'new' && menuAction('annotateLine', annotate, { label: `Annotate at ${linesWords(lines)}` }),
    copyLink && menuAction('copyLineLink', copyLink, { label: `Copy link to ${linesWords(lines)}`, shortcut: hotkey('copyLink') }),
    menuAction('copyLines', copyLines, { label: `Copy ${linesWords(lines)}` }),
  ];
}

/** The lines a place's action takes from lines selected: all of them, on their side. */
export function lineActionTarget(lines: FocusedLines): ChangedLines {
  return { side: lines.side === 'old' ? 'deletions' : 'additions', firstLineNumber: lines.first, lineNumber: lines.last };
}

/**
 * The lines the gutter's button acts on, by the line under the pointer: the lines selected when it's one of them, on
 * its side, and the place takes them all (`offers`), as GitHub comments on a selection; that line alone otherwise.
 */
export function lineActionTargetAt(line: ChangedLine, selected: FocusedLines | null | undefined, offers: (lines: ChangedLines) => boolean = () => true): ChangedLines {
  if (selected) {
    const range = lineActionTarget(selected);
    const holdsLine = range.side === line.side && line.lineNumber >= range.firstLineNumber && line.lineNumber <= range.lineNumber;
    if (holdsLine && offers(range)) return range;
  }
  return { ...line, firstLineNumber: line.lineNumber };
}

/**
 * The place's action, letting go of the lines selected once it runs on them: a comment opened on them is outlined in
 * the accent, and the selection's fill under its card, across both panes, was noise.
 */
export function releasingSelection(action: LineAction, selected: () => FocusedLines | null, clear: () => void): LineAction {
  const ranOn = (run: (lines: ChangedLines) => void) => (lines: ChangedLines): void => {
    run(lines);
    if (holdsSelected(lines, selected())) clear();
  };
  return { ...action, run: ranOn(action.run), ...(action.variant && { variant: { ...action.variant, run: ranOn(action.variant.run) } }) };
}

/** Whether lines an action ran on are among those selected: on their side, and inside them. */
export function holdsSelected(lines: ChangedLines, selected: FocusedLines | null): boolean {
  if (!selected) return false;
  const range = lineActionTarget(selected);
  return range.side === lines.side && lines.firstLineNumber >= range.firstLineNumber && lines.lineNumber <= range.lineNumber;
}

/**
 * The gutter button's tooltip: what it does, and on one line that a drag takes more ("Comment on line 4 · Drag for a
 * range"), as the line number's own hint says how to select (`lineNumberHint`).
 */
export function lineActionTip(label: string, lines: ChangedLines): string {
  return lines.lineNumber > lines.firstLineNumber ? label : `${label} · Drag for a range`;
}
