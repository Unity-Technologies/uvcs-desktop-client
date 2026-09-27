import { describe, expect, it } from 'vitest';
import { validateLabelName } from './labelNames';

describe('validateLabelName', () => {
  it('accepts release-like names', () => {
    expect(validateLabelName('v1.2.0')).toBeUndefined();
    expect(validateLabelName('release_2026-09')).toBeUndefined();
  });

  it('rejects the characters specs use, and spaces', () => {
    for (const name of ['v 1', 'v@1', 'v#1', 'v:1', 'v/1', 'v\\1']) expect(validateLabelName(name)).toBeDefined();
  });
});
