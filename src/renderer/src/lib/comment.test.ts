import { describe, expect, it } from 'vitest';
import { joinComment, looksLikeMarkdown, splitComment } from './comment';

describe('splitComment', () => {
  it('reads the first line as the summary and the rest as the description', () => {
    expect(splitComment('Fix the thing\n\nIt was broken.\nNow it is not.')).toEqual({ summary: 'Fix the thing', description: 'It was broken.\nNow it is not.' });
  });

  it('has no description for a one-line comment', () => {
    expect(splitComment('Remove useless loc')).toEqual({ summary: 'Remove useless loc', description: '' });
  });

  it('skips leading blank lines and Windows line ends', () => {
    expect(splitComment('\r\nTitle\r\nBody\r\n')).toEqual({ summary: 'Title', description: 'Body' });
  });

  it('is empty for an empty comment', () => {
    expect(splitComment('')).toEqual({ summary: '', description: '' });
  });
});

describe('joinComment', () => {
  it('separates the description with a blank line', () => {
    expect(joinComment({ summary: ' Title ', description: 'Body\n' })).toBe('Title\n\nBody');
  });

  it('leaves out what is empty', () => {
    expect(joinComment({ summary: 'Title', description: '  ' })).toBe('Title');
    expect(joinComment({ summary: '', description: 'Body' })).toBe('Body');
    expect(joinComment({ summary: '', description: '' })).toBe('');
  });

  it('gives back what splitComment read', () => {
    const comment = 'Title\n\nFirst paragraph.\n\nSecond one.';
    expect(joinComment(splitComment(comment))).toBe(comment);
  });
});

describe('looksLikeMarkdown', () => {
  it('recognizes headings, fences, quotes and lists', () => {
    expect(looksLikeMarkdown('## Why\nBecause.')).toBe(true);
    expect(looksLikeMarkdown('```\ncode\n```')).toBe(true);
    expect(looksLikeMarkdown('> quoted')).toBe(true);
    expect(looksLikeMarkdown('- one\n- two')).toBe(true);
    expect(looksLikeMarkdown('1. one\n2. two')).toBe(true);
  });

  it('recognizes links, bold and code', () => {
    expect(looksLikeMarkdown('See [the ticket](https://jira.example.com/VCS-1).')).toBe(true);
    expect(looksLikeMarkdown('This is **important**.')).toBe(true);
    expect(looksLikeMarkdown('Call `refresh()` first.')).toBe(true);
  });

  it('keeps plain prose plain', () => {
    expect(looksLikeMarkdown('Fixed the crash when opening a workspace.\nAlso tidied up the logs.')).toBe(false);
    expect(looksLikeMarkdown('* removed accelerator projects')).toBe(false);
    expect(looksLikeMarkdown('2 * 3 = 6, see https://example.com')).toBe(false);
  });
});
