import { describe, expect, it } from 'vitest';
import { commentLineText, commentText } from './commentText';

describe('commentLineText', () => {
  it('reads the first line without its marks, references as written and emoji as themselves', () => {
    expect(commentLineText('## Fix **the crash** in br:/main/task :tada:\n\nMore')).toBe('Fix the crash in br:/main/task 🎉');
  });

  it('is empty for an empty comment', () => {
    expect(commentLineText('  \n')).toBe('');
  });
});

describe('commentText', () => {
  it('keeps each line, lists with their markers', () => {
    expect(commentText('First\nsecond **bold**\n\n- [x] Done\n- Next\n\n1. One\n\n```\ncm up\n```')).toBe('First\nsecond bold\n• Done\n• Next\n1. One\ncm up');
  });
});
