import { describe, expect, it } from 'vitest';
import { displayName, initials, userFilterTexts } from './userName';

describe('displayName', () => {
  it('reads an email as a name', () => {
    expect(displayName('jane.doe@unity3d.com')).toBe('Jane Doe');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two words of a name', () => {
    expect(initials('jane.doe@unity3d.com')).toBe('JD');
    expect(initials('jane-doe')).toBe('JD');
    expect(initials('jane_doe')).toBe('JD');
    expect(initials('jane.mary.doe')).toBe('JM');
  });

  it('takes the first two letters of a one-word name, as people know it from the other clients', () => {
    expect(initials('danipen@unity3d.com')).toBe('DA');
    expect(initials('jd')).toBe('JD');
  });

  it('shows a one-letter name whole', () => {
    expect(initials('j@unity3d.com')).toBe('J');
  });

  it('reads letters beyond ASCII', () => {
    expect(initials('ñandú')).toBe('ÑA');
    expect(initials('\u{1D49C}bc')).toBe('\u{1D49C}B');
    expect(initials('\u{1D49C}x.bob')).toBe('\u{1D49C}B');
  });

  it('keeps an accent written as a separate mark with its letter', () => {
    expect(initials('n\u0303andu\u0301')).toBe('ÑA');
    expect(initials('n\u0303o.bob')).toBe('ÑB');
  });

  it('reads a name with extra spaces as its words', () => {
    expect(initials('Jane  Doe')).toBe('JD');
    expect(initials(' jane')).toBe('JA');
  });

  it('shows a question mark for an empty name', () => {
    expect(initials('')).toBe('?');
    expect(initials('@unity3d.com')).toBe('?');
  });
});

describe('userFilterTexts', () => {
  it('matches the name shown before the user as stored', () => {
    expect(userFilterTexts('jane.doe@unity3d.com')).toEqual(['Jane Doe', 'jane.doe@unity3d.com']);
  });
});
