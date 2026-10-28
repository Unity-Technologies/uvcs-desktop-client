import { describe, expect, it } from 'vitest';
import { commentHeading, commentLineInlines } from './commentHeading';
import { commentLineText } from './commentText';

describe('commentHeading', () => {
  it('takes the first line as the title and the rest as the description', () => {
    expect(commentHeading('Fix **the switch**\n\nIt kept the changes.')).toEqual({
      kind: 'titled',
      title: [{ kind: 'text', text: 'Fix ' }, { kind: 'strong', children: [{ kind: 'text', text: 'the switch' }] }],
      description: 'It kept the changes.',
    });
  });

  it('has no title for a comment that opens with code or a table, which shows whole', () => {
    expect(commentHeading('```csharp\nvar a = 1;\n```')).toEqual({ kind: 'block', description: '```csharp\nvar a = 1;\n```' });
    expect(commentHeading('| a | b |\n| - | - |\n| 1 | 2 |')).toEqual({ kind: 'block', description: '| a | b |\n| - | - |\n| 1 | 2 |' });
  });

  it('keeps the number a numbered first line starts with', () => {
    expect(commentHeading('3. Fix the build')).toEqual({ kind: 'titled', title: [{ kind: 'text', text: '3. ' }, { kind: 'text', text: 'Fix the build' }], description: '' });
  });

  it('has nothing for an empty comment', () => {
    expect(commentHeading('  \n ')).toEqual({ kind: 'empty' });
  });
});

describe('commentHeading of a comment that opens with a list or a quote', () => {
  it("takes the first item as the title, with its marker, and the rest as the description: nothing shows twice", () => {
    expect(commentHeading('- Tidied the README\n- Notes\n- Nothing else')).toEqual({
      kind: 'titled',
      title: [{ kind: 'text', text: '• ' }, { kind: 'text', text: 'Tidied the README' }],
      description: '- Notes\n- Nothing else',
    });
  });

  it('skips a rule it opens with', () => {
    expect(commentLineText('---\nShipped')).toBe('Shipped');
  });
});

describe('commentLineInlines', () => {
  it("reads a comment that opens with a block as its block's first line", () => {
    expect(commentLineText('- Fixed A\n- Fixed B')).toBe('• Fixed A');
    expect(commentLineText('3. Fix the build')).toBe('3. Fix the build');
    expect(commentLineText('2024. Retro')).toBe('2024. Retro');
    expect(commentLineText('- [x] Done')).toBe('☑ Done');
    expect(commentLineText('| Case | After |\n| :-- | --: |\n| a | b |')).toBe('Case · After');
    expect(commentLineInlines('```csharp\nvar a = 1;\n```')).toEqual([{ kind: 'code', text: 'var a = 1;' }]);
  });

  it('is empty for an empty comment', () => {
    expect(commentLineInlines('')).toEqual([]);
  });

  it('keeps a key in a row', () => {
    expect(commentLineInlines('Press <kbd>Esc</kbd> to cancel')).toEqual([
      { kind: 'text', text: 'Press ' },
      { kind: 'key', text: 'Esc' },
      { kind: 'text', text: ' to cancel' },
    ]);
  });
});

