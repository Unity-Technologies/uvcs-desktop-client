/**
 * For tests: pairs of versions of every kind of text the diff viewer takes (line breaks, final line breaks, whitespace,
 * empty sides), each with changes at its start, in its middle and at its end.
 */
const CODE = Array.from({ length: 12 }, (_, i) => (i % 4 === 0 ? `function f${i}() {` : i % 4 === 3 ? '}' : `  const v${i} = ${i};`));
const edited = (lines: string[]) => lines.map((line, i) => (i === 0 ? `${line} // first` : i === 5 ? 'middle();' : i === lines.length - 1 ? `${line} // last` : line));
const joined = (lines: string[], eol: string, final = true) => lines.join(eol) + (final ? eol : '');
const mixed = (lines: string[]) => lines.map((line, i) => line + ['\n', '\r\n', '\r'][i % 3]).join('');

export const DIFF_TEST_TEXTS: Record<string, [original: string, modified: string]> = {
  'LF': [joined(CODE, '\n'), joined(edited(CODE), '\n')],
  'CRLF': [joined(CODE, '\r\n'), joined(edited(CODE), '\r\n')],
  'lone CRs': [joined(CODE, '\r'), joined(edited(CODE), '\r')],
  'mixed line breaks': [mixed(CODE), mixed(edited(CODE))],
  'no final line break': [joined(CODE, '\n', false), joined(edited(CODE), '\n', false)],
  'CRLF, no final line break': [joined(CODE, '\r\n', false), joined(edited(CODE), '\r\n', false)],
  'final line break removed': [joined(CODE, '\n'), joined(edited(CODE), '\n', false)],
  'final line break added': [joined(CODE, '\n', false), joined(edited(CODE), '\n')],
  'CRLF made LF': [joined(CODE, '\r\n'), joined(edited(CODE), '\n')],
  'lone CRs made LF': [joined(CODE, '\r'), joined(edited(CODE), '\n')],
  'whitespace': [joined(CODE, '\n'), joined(CODE.map((line, i) => (i === 2 ? `${line}  ` : i === 6 ? `\t${line.trimStart()}` : i === 9 ? line.replace(' = ', '  =  ') : line)), '\n')],
  'lines added and removed': [joined(CODE, '\n'), joined([...CODE.slice(0, 3), 'inserted();', ...CODE.slice(3, 7), ...CODE.slice(8)], '\n')],
  'from an empty file': ['', joined(CODE.slice(0, 5), '\n')],
  'emptied': [joined(CODE.slice(0, 5), '\n'), ''],
};
