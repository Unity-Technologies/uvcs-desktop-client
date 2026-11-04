import { describe, expect, it } from 'vitest';
import type { DrawContext } from './drawContext';
import type { GraphPalette } from './graphPalette';
import { drawHomeBadge, drawHomeMarker, HOME_BADGE_SHADOW } from './drawHomeMarker';

/** A 2D context that records the dashes and shadows set on it; everything else does nothing. */
function recordingContext(): { ctx: CanvasRenderingContext2D; dashes: number[][]; shadowBlurs: number[] } {
  const dashes: number[][] = [];
  const shadowBlurs: number[] = [];
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get: (target, property) => {
      if (property === 'setLineDash') return (segments: number[]) => dashes.push(segments);
      return property in target ? target[property] : () => undefined;
    },
    set: (target, property, value) => {
      if (property === 'shadowBlur') shadowBlurs.push(value as number);
      target[property] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, dashes, shadowBlurs };
}

const palette = { accent: 'accent', surfaceRaised: 'surface', badgeShadow: 'shadow' } as GraphPalette;
const dashed = (dashes: number[][]) => dashes.some((segments) => segments.length > 0);

describe('the home badge', () => {
  it('is plain on the graph: never dashed, never shadowed', () => {
    const recording = recordingContext();
    const draw = { ctx: recording.ctx, scene: { viewport: { zoom: 1, panX: 0, panY: 0 }, palette }, pixelRatio: 1 } as unknown as DrawContext;
    drawHomeMarker(draw, { x: 100, y: 100 }, 11);
    expect(dashed(recording.dashes)).toBe(false);
    expect(recording.shadowBlurs).toEqual([]);
  });

  it('is dashed for pending changes and lifted by a shadow when asked, as the Timeline draws it', () => {
    const recording = recordingContext();
    drawHomeBadge(recording.ctx, 50, 20, 9, palette, { dashed: true, shadow: true });
    expect(dashed(recording.dashes)).toBe(true);
    expect(recording.shadowBlurs).toContain(HOME_BADGE_SHADOW.blur);
  });
});
