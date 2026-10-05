import { describe, expect, it } from 'vitest';
import { layoutOf, paneAt } from './viewLayout';

describe('layoutOf', () => {
  it('gives a version shown alone the whole canvas', () => {
    expect(layoutOf('single', 800, 600, 0.5, 'before')).toEqual({
      panes: [{ side: 'before', viewport: { x: 0, y: 0, width: 800, height: 600 }, scissor: { x: 0, y: 0, width: 800, height: 600 } }],
      blended: false,
    });
  });

  it('splits the canvas in halves with no gap and no overlap, before on the left', () => {
    const { panes } = layoutOf('sideBySide', 801, 600);
    expect(panes.map((pane) => [pane.side, pane.viewport.x, pane.viewport.width])).toEqual([
      ['before', 0, 401],
      ['after', 401, 400],
    ]);
  });

  it('draws both versions through one view for a swipe, each cut at the divider', () => {
    const { panes } = layoutOf('swipe', 1000, 500, 0.3);
    expect(panes.map((pane) => pane.viewport.width)).toEqual([1000, 1000]);
    expect(panes.map((pane) => [pane.scissor.x, pane.scissor.width])).toEqual([
      [0, 300],
      [300, 700],
    ]);
  });

  it('draws the version after full size for the differences, the version before over it in the same view', () => {
    const { panes, blended } = layoutOf('differences', 400, 300);
    expect(panes.map((pane) => [pane.side, pane.viewport.width, pane.overlay ?? false])).toEqual([
      ['after', 400, false],
      ['before', 400, true],
    ]);
    expect(blended).toBe(false);
  });

  it('blends both full-size versions for the onion skin', () => {
    expect(layoutOf('onion', 400, 300).blended).toBe(true);
  });
});

describe('paneAt', () => {
  it('finds the half under the pointer, at any pixel ratio', () => {
    const layout = layoutOf('sideBySide', 1600, 1200);
    expect(paneAt(layout, 100, 50, 600, 2)?.side).toBe('before');
    expect(paneAt(layout, 700, 50, 600, 2)?.side).toBe('after');
    expect(paneAt(layout, 900, 50, 600, 2)).toBeNull();
  });
});
