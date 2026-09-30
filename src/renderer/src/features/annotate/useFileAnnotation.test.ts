import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { isImmutableAnnotation } from './useFileAnnotation';

describe('isImmutableAnnotation', () => {
  it('caches the annotation of a revision by id for good', () => {
    expect(isImmutableAnnotation('revid:432251@game@local:8087')).toBe(true);
  });

  it("follows the workspace's own version as it's edited", () => {
    expect(isImmutableAnnotation(undefined)).toBe(false);
  });
});
