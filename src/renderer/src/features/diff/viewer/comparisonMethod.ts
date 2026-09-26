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

const LINE_BREAK = /(\r\n|\r|\n)*$/;

/** What of a line (its line break included) is compared under `method`. */
export function comparedPart(line: string, method: ComparisonMethod): string {
  switch (method) {
    case 'recognizeAll':
      return line;
    case 'ignoreEol':
      return line.replace(/^[\r\n]+|[\r\n]+$/g, '');
    case 'ignoreEolAndWhitespace':
      return line.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
    case 'ignoreWhitespace': {
      const lineBreak = LINE_BREAK.exec(line)![0];
      return line.slice(0, line.length - lineBreak.length).replace(/^[ \t]+|[ \t]+$/g, '') + lineBreak;
    }
  }
}
