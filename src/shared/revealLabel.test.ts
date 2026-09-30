import { describe, expect, it } from 'vitest';
import { revealLabel } from './revealLabel';

describe('revealLabel', () => {
  it("names each OS's file manager", () => {
    expect(revealLabel('darwin')).toBe('Reveal in Finder');
    expect(revealLabel('win32')).toBe('Show in Explorer');
    expect(revealLabel('linux')).toBe('Show in file manager');
  });
});
