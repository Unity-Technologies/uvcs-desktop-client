import { describe, expect, it } from 'vitest';
import { displayName, userFilterTexts } from './userName';

describe('displayName', () => {
  it('reads an email as a name', () => {
    expect(displayName('jane.doe@unity3d.com')).toBe('Jane Doe');
  });
});

describe('userFilterTexts', () => {
  it('matches the name shown before the user as stored', () => {
    expect(userFilterTexts('jane.doe@unity3d.com')).toEqual(['Jane Doe', 'jane.doe@unity3d.com']);
  });
});
