import { describe, expect, it } from 'vitest';
import { editedComment, joinComment, looksLikeMarkdown, splitComment, withSummaryText } from './comment';

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

describe('editedComment', () => {
  const opened = (comment: string) => splitComment(comment);

  it('gives back the original unchanged when nothing was edited', () => {
    for (const comment of ['Title\nBody on the next line', 'One long line: no title and description written as such.', '  Padded \n\n\nBody  \n', 'Title\r\n\r\nBody']) {
      expect(editedComment(comment, opened(comment), opened(comment))).toBe(comment);
    }
  });

  it('keeps the line end the original had after its title', () => {
    const comment = 'Title\nBody';
    expect(editedComment(comment, opened(comment), { summary: 'Title', description: 'Body, edited' })).toBe('Title\nBody, edited');
    const spaced = 'Title\n\nBody';
    expect(editedComment(spaced, opened(spaced), { summary: 'New title', description: 'Body' })).toBe('New title\n\nBody');
  });

  it('separates a new description with a blank line', () => {
    const comment = 'A single long line';
    expect(editedComment(comment, opened(comment), { summary: 'A single long line', description: 'Now with a body.' })).toBe('A single long line\n\nNow with a body.');
  });

  it('leaves out what is empty, and trims what the user left around it', () => {
    const comment = 'Title\n\nBody';
    expect(editedComment(comment, opened(comment), { summary: ' Title ', description: '' })).toBe('Title');
    expect(editedComment(comment, opened(comment), { summary: '', description: '\n  Body\n' })).toBe('  Body');
    expect(editedComment(comment, opened(comment), { summary: '', description: ' ' })).toBe('');
  });

  it('reads a comment opened whole as a description the same way', () => {
    const comment = 'Release notes\nline two\n';
    const whole = { summary: '', description: comment.trim() };
    expect(editedComment(comment, whole, whole)).toBe(comment);
    expect(editedComment(comment, whole, { summary: '', description: 'Other notes' })).toBe('Other notes');
  });
});

describe('withSummaryText', () => {
  it('takes a title without line ends as it is', () => {
    expect(withSummaryText({ summary: 'Old', description: 'Body' }, 'New title ')).toEqual({ summary: 'New title ', description: 'Body' });
  });

  it('moves what follows a line end into the description, ahead of it', () => {
    expect(withSummaryText({ summary: '', description: 'Body' }, 'Title\r\nPasted line\nAnother')).toEqual({ summary: 'Title', description: 'Pasted line\nAnother\nBody' });
    expect(withSummaryText({ summary: '', description: '' }, 'Title\n')).toEqual({ summary: 'Title', description: '' });
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
