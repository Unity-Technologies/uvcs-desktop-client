/**
 * "Go to line…": asks for a line of the side it's on, the one the caret or the right-click is on already in the field
 * (selected, so typing replaces it), and takes only a line that side has.
 */
export interface GoToLineQuestion {
  title: string;
  label: string;
  initialValue: string;
}

export function goToLineQuestion(lineCount: number, currentLine: number | null): GoToLineQuestion {
  return {
    title: 'Go to line',
    label: lineCount === 1 ? 'Line number (the text has one line)' : `Line number (1–${lineCount})`,
    initialValue: currentLine === null ? '' : String(Math.min(Math.max(currentLine, 1), lineCount)),
  };
}

/** Why the text typed names no line of the side; undefined when it does. */
export function goToLineError(typed: string, lineCount: number): string | undefined {
  const line = typedLine(typed);
  if (line === null) return 'Type a line number';
  if (line < 1 || line > lineCount) return lineCount === 1 ? 'The text has one line' : `Type a number from 1 to ${lineCount}`;
  return undefined;
}

/** The line typed, once it names one of the side's (`goToLineError` says why not otherwise). */
export function lineToGoTo(typed: string, lineCount: number): number | null {
  return goToLineError(typed, lineCount) === undefined ? typedLine(typed) : null;
}

/** The whole number typed, digits only around any spaces (a pasted "42 "); null for anything else. */
function typedLine(typed: string): number | null {
  const digits = typed.trim();
  if (!/^\d{1,9}$/.test(digits)) return null;
  return Number(digits);
}
