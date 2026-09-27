import { describe, expect, it } from 'vitest';
import { OriginPen, originFor } from './pen';

describe('originFor', () => {
  it('is zero while the visible area starts within the first step or before the graph, so small graphs draw as they always did', () => {
    expect(originFor(0)).toBe(0);
    expect(originFor(-80)).toBe(0);
    expect(originFor(16000)).toBe(0);
  });

  it('stays at or before the visible area, within a step of it', () => {
    for (const start of [16384, 1e7 + 0.5, 2_468_123.25]) {
      const origin = originFor(start);
      expect(origin).toBeLessThanOrEqual(start);
      expect(start - origin).toBeLessThan(16384);
    }
  });
});

describe('OriginPen', () => {
  it('hands the canvas positions relative to its origin, sizes untouched', () => {
    const calls: unknown[][] = [];
    const record =
      (name: string) =>
      (...args: unknown[]): void => {
        calls.push([name, ...args]);
      };
    const ctx = { arc: record('arc'), roundRect: record('roundRect'), fillText: record('fillText') } as unknown as CanvasRenderingContext2D;
    const pen = new OriginPen();
    pen.aim(ctx, 10_000_000, 2_000_000);

    pen.arc(10_000_012.5, 2_000_030, 11, 0, Math.PI * 2);
    pen.roundRect(9_999_990, 2_000_001, 200, 22, 6);
    pen.fillText('main', 10_000_100, 1_999_990);

    expect(calls).toEqual([
      ['arc', 12.5, 30, 11, 0, Math.PI * 2],
      ['roundRect', -10, 1, 200, 22, 6],
      ['fillText', 'main', 100, -10],
    ]);
  });
});
