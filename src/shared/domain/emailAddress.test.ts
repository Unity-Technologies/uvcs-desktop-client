import { describe, expect, it } from 'vitest';
import { isEmailAddress } from './emailAddress';

describe('who has a picture to ask for', () => {
  it('is someone named by an email address, spaces and case aside', () => {
    expect(isEmailAddress(' Ana.Diaz@Unity.com ')).toBe(true);
    expect(isEmailAddress('josé@ejemplo.es')).toBe(true);
  });

  it('is never someone named otherwise', () => {
    expect(isEmailAddress('daniel')).toBe(false);
    expect(isEmailAddress('DOMAIN\\daniel')).toBe(false);
    expect(isEmailAddress('ana@localhost')).toBe(false);
    expect(isEmailAddress('')).toBe(false);
  });
});
