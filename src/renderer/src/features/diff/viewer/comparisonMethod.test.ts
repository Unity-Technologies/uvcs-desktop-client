import { describe, expect, it } from 'vitest';
import { listChangeBlocks } from './changeBlocks';
import { comparedPart, type ComparisonMethod } from './comparisonMethod';
import { lineDiff } from './lineDiff';

const blocksUnder = (method: ComparisonMethod, original: string, modified: string) => listChangeBlocks(lineDiff(original, modified, method, 'a.cs').meta);

describe('comparedPart', () => {
  it('keeps every character when recognizing all', () => {
    expect(comparedPart('  a \r\n', 'recognizeAll')).toBe('  a \r\n');
  });

  it('drops the line break, whichever it is, when ignoring EOLs', () => {
    expect(comparedPart('a\r\n', 'ignoreEol')).toBe('a');
    expect(comparedPart('a\n', 'ignoreEol')).toBe('a');
    expect(comparedPart('a', 'ignoreEol')).toBe('a');
    expect(comparedPart(' a \n', 'ignoreEol')).toBe(' a ');
  });

  it('trims spaces and tabs at both ends but keeps the line break when ignoring whitespaces', () => {
    expect(comparedPart('\t  a  b \t\r\n', 'ignoreWhitespace')).toBe('a  b\r\n');
    expect(comparedPart('   \n', 'ignoreWhitespace')).toBe('\n');
    expect(comparedPart('a  ', 'ignoreWhitespace')).toBe('a');
  });

  it('trims both when ignoring EOLs and whitespaces, keeping whitespace inside the line', () => {
    expect(comparedPart('\t a  b \r\n', 'ignoreEolAndWhitespace')).toBe('a  b');
  });
});

describe('the diff under each comparison method', () => {
  const lf = 'a\nb\nc\n';
  const crlf = 'a\r\nb\r\nc\r\n';

  it('shows a change of line endings only when recognizing all or ignoring whitespaces', () => {
    expect(blocksUnder('recognizeAll', lf, crlf)).toHaveLength(1);
    expect(blocksUnder('ignoreWhitespace', lf, crlf)).toHaveLength(1);
    expect(blocksUnder('ignoreEol', lf, crlf)).toEqual([]);
    expect(blocksUnder('ignoreEolAndWhitespace', lf, crlf)).toEqual([]);
  });

  it('ignores a missing final line break with the EOLs', () => {
    expect(blocksUnder('ignoreEol', 'a\nb\n', 'a\nb')).toEqual([]);
    expect(blocksUnder('recognizeAll', 'a\nb\n', 'a\nb')).toHaveLength(1);
  });

  it('ignores indentation and trailing spaces, not whitespace inside a line', () => {
    const original = 'if (x)\n    y = 1;\nz\n';
    expect(blocksUnder('ignoreWhitespace', original, 'if (x)\n\ty = 1;   \nz\n')).toEqual([]);
    expect(blocksUnder('ignoreWhitespace', original, 'if (x)\n    y  = 1;\nz\n')).toEqual([{ index: 0, oldStart: 2, oldLines: 1, newStart: 2, newLines: 1 }]);
  });

  it('keeps showing real changes among ignored ones, at their own lines', () => {
    const modified = 'a\r\nB\r\nc\r\n';
    expect(blocksUnder('ignoreEol', lf, modified)).toEqual([{ index: 0, oldStart: 2, oldLines: 1, newStart: 2, newLines: 1 }]);
  });
});

describe('the diff of texts with lone CRs, shown as LFs', () => {
  const shownBlocksUnder = blocksUnder;
  const cr = 'a\rb\rc\r';

  it('compares CR, LF and CRLF equal when ignoring EOLs', () => {
    for (const method of ['ignoreEol', 'ignoreEolAndWhitespace'] as const) {
      expect(shownBlocksUnder(method, cr, 'a\nb\nc\n')).toEqual([]);
      expect(shownBlocksUnder(method, cr, 'a\r\nb\r\nc\r\n')).toEqual([]);
      expect(shownBlocksUnder(method, 'a\nb\nc\n', cr)).toEqual([]);
    }
  });

  it('tells CR from LF and CRLF when line endings count', () => {
    for (const method of ['recognizeAll', 'ignoreWhitespace'] as const) {
      expect(shownBlocksUnder(method, cr, 'a\nb\nc\n')).toHaveLength(1);
      expect(shownBlocksUnder(method, cr, 'a\r\nb\r\nc\r\n')).toHaveLength(1);
      expect(shownBlocksUnder(method, cr, cr)).toEqual([]);
    }
  });

  it('keeps a missing final line break apart from the line endings that changed', () => {
    expect(shownBlocksUnder('recognizeAll', 'a\rb', 'a\nb')).toEqual([{ index: 0, oldStart: 1, oldLines: 1, newStart: 1, newLines: 1 }]);
  });
});
