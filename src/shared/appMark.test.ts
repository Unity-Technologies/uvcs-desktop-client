import { describe, expect, it } from 'vitest';
import { APP_ICON_CANVAS, APP_MARK, appIconSvg } from './appMark';

/** Where the icon's tile lands on its canvas, read from the SVG's transform. */
function tileOf(svg: string): { left: number; top: number; size: number } {
  const [, left, top, scale] = svg.match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/)!;
  return { left: Number(left), top: Number(top), size: Number(scale) * APP_MARK.size };
}

describe('appIconSvg', () => {
  it("puts the macOS tile on Apple's icon grid: 824 pixels, centered on the 1024 canvas", () => {
    expect(tileOf(appIconSvg('macOS'))).toEqual({ left: 100, top: 100, size: 824 });
  });

  it('fills the canvas with the tile for Windows and Linux', () => {
    expect(tileOf(appIconSvg('edgeToEdge'))).toEqual({ left: 0, top: 0, size: APP_ICON_CANVAS });
  });

  it('draws the whole canvas at the size asked, so each size is drawn from the vectors', () => {
    const svg = appIconSvg('macOS', 16);

    expect(svg).toContain('width="16" height="16" viewBox="0 0 1024 1024"');
    expect(tileOf(svg)).toEqual(tileOf(appIconSvg('macOS')));
  });

  it("draws the mark's lines and changesets", () => {
    const svg = appIconSvg('edgeToEdge');

    for (const line of APP_MARK.lines) expect(svg).toContain(`d="${line}"`);
    expect(svg.match(/<circle /g)).toHaveLength(APP_MARK.changesets.length);
  });
});
