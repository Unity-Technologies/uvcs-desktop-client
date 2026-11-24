import { describe, expect, it } from 'vitest';
import { breakAfterSlashes } from './breakAfterSlashes';

describe('breakAfterSlashes', () => {
  it('cuts a path after each slash, so it wraps between its folders', () => {
    expect(breakAfterSlashes('/src/client/Store.cs at branch /main')).toEqual(['/', 'src/', 'client/', 'Store.cs at branch /', 'main']);
  });

  it('leaves text with no slash whole', () => {
    expect(breakAfterSlashes('Changeset 4207')).toEqual(['Changeset 4207']);
  });

  it('keeps every character, so the parts join back into the text', () => {
    const text = '/a//b/ñandú/';
    expect(breakAfterSlashes(text).join('')).toBe(text);
  });
});
