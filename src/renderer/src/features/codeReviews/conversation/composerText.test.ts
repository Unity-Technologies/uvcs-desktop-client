import { describe, expect, it } from 'vitest';
import { composerText, isSendable } from './composerText';

describe('composerText', () => {
  it('shows the draft, else what the composer opened with', () => {
    expect(composerText({ summary: '', description: 'Typed' }, 'Saved')).toBe('Typed');
    expect(composerText({ summary: '', description: '' }, 'Saved')).toBe('');
    expect(composerText(undefined, 'Saved')).toBe('Saved');
  });
});

describe('isSendable', () => {
  it('sends a new comment only once it says something', () => {
    expect(isSendable('', '', false)).toBe(false);
    expect(isSendable('  \n', '', false)).toBe(false);
    expect(isSendable('Nice', '', false)).toBe(true);
  });

  it('saves an edit only once it changed', () => {
    expect(isSendable('Saved', 'Saved', false)).toBe(false);
    expect(isSendable('Saved!', 'Saved', false)).toBe(true);
  });

  it('saves an emptied description, which clears it', () => {
    expect(isSendable('', 'Why', true)).toBe(true);
    expect(isSendable('', 'Why', false)).toBe(false);
  });
});
