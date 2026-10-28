import { describe, expect, it } from 'vitest';
import { commentHeading, commentLineInlines } from './commentHeading';
import { commentLineText } from './commentText';

describe('commentHeading', () => {
  it('takes the first line as the title and the rest as the description', () => {
    expect(commentHeading('Fix the switch\n\nIt kept the changes.')).toEqual({ title: 'Fix the switch', description: 'It kept the changes.' });
  });

  it('has no title for a comment that opens with a block, which shows whole', () => {
    expect(commentHeading('- Fixed A\n- Fixed B\n- Fixed C')).toEqual({ title: null, description: '- Fixed A\n- Fixed B\n- Fixed C' });
    expect(commentHeading('```csharp\nvar a = 1;\n```')).toEqual({ title: null, description: '```csharp\nvar a = 1;\n```' });
    expect(commentHeading('| a | b |\n| - | - |\n| 1 | 2 |')).toMatchObject({ title: null });
    expect(commentHeading('3. Fix the build')).toMatchObject({ title: null, description: '3. Fix the build' });
  });

  it('has nothing for an empty comment', () => {
    expect(commentHeading('  \n ')).toEqual({ title: null, description: '' });
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
});
