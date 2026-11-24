import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { changeRequestLineText, commentLineTextOf } from './suggestionPreview';

const LINES = { firstLine: 24, lastLine: 152 };
const ONLY_SUGGESTION = '```suggestion\n    public static int Value22 => 22;\n```';

describe('changeRequestLineText', () => {
  it('names one that opens with its suggestion by the lines it replaces, not its first line of code', () => {
    expect(changeRequestLineText(ONLY_SUGGESTION, LINES)).toBe('Suggested change on lines 24–152');
    expect(changeRequestLineText('```suggestion\r\n{\r\n```', { firstLine: 7, lastLine: 7 })).toBe('Suggested change on line 7');
    expect(changeRequestLineText('````suggestion\n```\n````\n\nWhy: the fence.', LINES)).toBe('Suggested change on lines 24–152');
  });

  it('keeps the first line of one that says something before its suggestion, or holds none', () => {
    expect(changeRequestLineText(`Name it **after** the value\n\n${ONLY_SUGGESTION}`, LINES)).toBe('Name it after the value');
    expect(changeRequestLineText('```cs\nint x;\n```', LINES)).toBe('int x;');
  });

  it('keeps the first line of one on the whole review, which has no lines to name', () => {
    expect(changeRequestLineText(ONLY_SUGGESTION, undefined)).toBe('public static int Value22 => 22;');
  });
});

describe('commentLineTextOf', () => {
  const comment = (kind: ReviewComment['kind']) => ({ kind, text: ONLY_SUGGESTION, anchor: { kind: 'line', revisionId: 3, itemId: 4, path: '/Long.cs', ...LINES } as const });

  it("names a change request's suggestion, and leaves a question's fence as the code it is", () => {
    expect(commentLineTextOf(comment('changeRequest'))).toBe('Suggested change on lines 24–152');
    expect(commentLineTextOf(comment('question'))).toBe('public static int Value22 => 22;');
  });
});
