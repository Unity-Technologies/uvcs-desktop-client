import { describe, expect, it } from 'vitest';
import { validateAttributeName } from './attributeNames';

describe('validateAttributeName', () => {
  it('accepts a single word', () => {
    expect(validateAttributeName('release_notes')).toBeUndefined();
  });

  it('rejects spaces', () => {
    expect(validateAttributeName('release notes')).toBeDefined();
  });
});
