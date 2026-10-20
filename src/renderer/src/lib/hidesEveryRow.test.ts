import { describe, expect, it } from 'vitest';
import { hidesEveryRow } from './hidesEveryRow';

describe('hidesEveryRow', () => {
  it('is true only when rows were read and none shows', () => {
    expect(hidesEveryRow(5, 0)).toBe(true);
    expect(hidesEveryRow(5, 2)).toBe(false);
  });

  it('tells nothing read apart from everything filtered out', () => {
    expect(hidesEveryRow(0, 0)).toBe(false);
  });
});
