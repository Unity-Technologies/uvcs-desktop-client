import { describe, expect, it } from 'vitest';
import { clipboardComparison, clipboardText, fragmentOfLines, fragmentOfSpan, type FragmentSource } from './clipboardComparison';

const PLAYER: FragmentSource = { fileName: 'Assets/Scripts/Player.cs', side: 'new', text: 'void Start() {\r\n  speed = 4;\r\n  jump = 2;\r\n}\r\n' };
const at = (startLine: number, startCharacter: number, endLine: number, endCharacter: number) => ({
  start: { line: startLine, character: startCharacter },
  end: { line: endLine, character: endCharacter },
});

describe('the code selected', () => {
  it('is the text selected to the character, its lines joined by LF whatever the file has', () => {
    expect(fragmentOfSpan(PLAYER, at(1, 2, 2, 6))).toEqual({ fileName: 'Assets/Scripts/Player.cs', side: 'new', lines: { first: 2, last: 3 }, text: 'speed = 4;\n  jump' });
  });

  it('is none for a caret: there is nothing to compare', () => {
    expect(fragmentOfSpan(PLAYER, at(1, 2, 1, 2))).toBeNull();
  });

  it('is whole lines picked by their numbers, without the last line break', () => {
    expect(fragmentOfLines(PLAYER, { first: 2, last: 3 }).text).toBe('  speed = 4;\n  jump = 2;');
    expect(fragmentOfLines(PLAYER, { first: 4, last: 4 }).text).toBe('}');
  });

  it('keeps Unicode text whole', () => {
    const source: FragmentSource = { fileName: 'notes.md', side: null, text: 'Ünïcödé 🙂 text\n' };
    expect(fragmentOfSpan(source, at(0, 8, 0, 10))?.text).toBe('🙂');
  });
});

describe('clipboardText', () => {
  it("takes the clipboard's CRLF and CR line breaks as LF, as the selection has them", () => {
    expect(clipboardText('a\r\nb\rc\n')).toBe('a\nb\nc\n');
  });

  it('is none when the clipboard holds no text', () => {
    expect(clipboardText('')).toBeNull();
  });

  it('keeps text that is only spaces or Unicode, which is text to compare', () => {
    expect(clipboardText('  ')).toBe('  ');
    expect(clipboardText('café 🙂')).toBe('café 🙂');
  });
});

describe('clipboardComparison', () => {
  const selection = fragmentOfLines(PLAYER, { first: 2, last: 3 });

  it('puts the clipboard on the left and the selection on the right, the lines in the title and the file under it', () => {
    const shown = clipboardComparison('  speed = 4;\n', selection, 'recognizeAll');
    expect(shown.title).toBe('Clipboard compared with lines 2–3');
    expect(shown.description).toBe('Player.cs (after)');
    expect(shown.fileName).toBe('Assets/Scripts/Player.cs');
    if (shown.comparison.kind !== 'diff') throw new Error('a diff');
    expect(shown.comparison.diff.meta.deletionLines.join('')).not.toContain('jump');
    expect(shown.comparison.diff.meta.additionLines.join('')).toContain('jump = 2;');
  });

  it('names one line, the older version, and a file shown alone without a version', () => {
    expect(clipboardComparison('x', { ...selection, side: 'old', lines: { first: 7, last: 7 } }, 'recognizeAll')).toMatchObject({ title: 'Clipboard compared with line 7', description: 'Player.cs (before)' });
    expect(clipboardComparison('x', { ...selection, fileName: 'C:\\game\\Enemy.cs', side: null }, 'recognizeAll').description).toBe('Enemy.cs');
  });

  it('compares a clipboard of several lines, copied with CRLF on Windows, as the lines it holds', () => {
    const copied = clipboardText('  speed = 4;\r\n  jump = 2;\r\n')!;
    expect(clipboardComparison(copied, selection, 'recognizeAll').comparison).toMatchObject({ kind: 'unchanged', note: 'The clipboard holds the selected text' });
  });

  it("says nothing of a final line break: each text's last line is ended, whether or not it was copied with one", () => {
    expect(clipboardComparison('  speed = 4;\n  jump = 2;', selection, 'recognizeAll').comparison).toMatchObject({ kind: 'unchanged', code: '  speed = 4;\n  jump = 2;' });
    const shown = clipboardComparison('a\nb', { ...selection, text: 'a\nc' }, 'recognizeAll');
    expect(shown.comparison.kind === 'diff' && shown.comparison.diff.meta.hunks.every((hunk) => !hunk.noEOFCRDeletions && !hunk.noEOFCRAdditions)).toBe(true);
  });

  it('says when they differ only in what the comparison method ignores', () => {
    expect(clipboardComparison('speed = 4;\njump = 2;', selection, 'ignoreWhitespace').comparison).toMatchObject({ kind: 'unchanged', note: 'Only whitespace differs' });
  });
});
