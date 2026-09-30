import { describe, expect, it } from 'vitest';
import { anchoredOffset, composedSize } from './composedFrame';

describe('composedSize', () => {
  it('is the larger of both sizes on each axis', () => {
    expect(composedSize({ width: 4, height: 10 }, { width: 6, height: 2 })).toEqual({ width: 6, height: 10 });
  });
});

describe('anchoredOffset', () => {
  it('centers a revision, floored to whole pixels', () => {
    expect(anchoredOffset({ width: 10, height: 10 }, { width: 4, height: 4 }, 'center')).toEqual({ x: 3, y: 3 });
    expect(anchoredOffset({ width: 5, height: 5 }, { width: 2, height: 2 }, 'center')).toEqual({ x: 1, y: 1 });
  });

  it('pins a revision to the top-left corner', () => {
    expect(anchoredOffset({ width: 10, height: 10 }, { width: 4, height: 4 }, 'top-left')).toEqual({ x: 0, y: 0 });
  });
});
