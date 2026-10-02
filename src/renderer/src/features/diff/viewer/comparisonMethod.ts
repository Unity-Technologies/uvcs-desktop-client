/**
 * Which differences between two texts count, as the official Desktop client's "Comparison method" (its
 * `ComparisonMethodTypes`): lines are compared after trimming what the method ignores from both of their ends, so a
 * line only differs from another by what's left. Whitespace inside a line always counts.
 */
export type ComparisonMethod = 'ignoreEol' | 'ignoreWhitespace' | 'ignoreEolAndWhitespace' | 'recognizeAll';

/** Like the official client, which stores `NotIgnore` in plasticgui.conf until the user picks another one. */
export const DEFAULT_COMPARISON_METHOD: ComparisonMethod = 'recognizeAll';

export interface ComparisonMethodOption {
  value: ComparisonMethod;
  label: string;
  description: string;
}

/** In the official client's menu order. */
export const COMPARISON_METHODS: ComparisonMethodOption[] = [
  { value: 'ignoreEol', label: 'Ignore EOLs', description: 'CRLF, LF and CR line endings compare equal' },
  { value: 'ignoreWhitespace', label: 'Ignore whitespaces', description: 'Spaces and tabs at the start and end of lines' },
  { value: 'ignoreEolAndWhitespace', label: 'Ignore EOLs and whitespaces', description: 'Both line endings and spaces or tabs at line ends' },
  { value: 'recognizeAll', label: 'Recognize all', description: 'Every character counts' },
];

/** Whether CRLF, LF and CR compare equal under `method`. */
export function ignoresLineEndings(method: ComparisonMethod): boolean {
  return method === 'ignoreEol' || method === 'ignoreEolAndWhitespace';
}

export function comparisonMethodLabel(method: ComparisonMethod): string {
  return COMPARISON_METHODS.find((option) => option.value === method)!.label;
}

const LINE_BREAKS = '\r\n';
const WHITESPACE = ' \t';
const WHITESPACE_AND_LINE_BREAKS = ' \t\r\n';

/**
 * What of a line (its line break included) is compared under `method`. A file's text is anyone's, so lines are trimmed
 * by scanning in from their ends, never with a regular expression: one anchored at the end (`[ \t]+$`) goes back over
 * every run of whitespace inside the line, which a long line makes freeze the diff.
 */
export function comparedPart(line: string, method: ComparisonMethod): string {
  switch (method) {
    case 'recognizeAll':
      return line;
    case 'ignoreEol':
      return trimmed(line, LINE_BREAKS);
    case 'ignoreEolAndWhitespace':
      return trimmed(line, WHITESPACE_AND_LINE_BREAKS);
    case 'ignoreWhitespace': {
      const textEnd = endBefore(line, LINE_BREAKS, 0);
      return trimmed(line.slice(0, textEnd), WHITESPACE) + line.slice(textEnd);
    }
  }
}

/** `text` without the run of `characters` at its start and the one at its end. */
function trimmed(text: string, characters: string): string {
  let start = 0;
  while (start < text.length && characters.includes(text[start]!)) start++;
  return text.slice(start, endBefore(text, characters, start));
}

/** Where the run of `characters` that ends `text` starts, no earlier than `start`. */
function endBefore(text: string, characters: string, start: number): number {
  let end = text.length;
  while (end > start && characters.includes(text[end - 1]!)) end--;
  return end;
}
