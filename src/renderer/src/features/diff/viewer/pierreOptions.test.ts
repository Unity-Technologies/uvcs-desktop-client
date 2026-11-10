import { describe, expect, it } from 'vitest';
import { PIERRE_SURFACE_CSS, pierreDiffOptions } from './pierreOptions';

const css = pierreDiffOptions({ theme: 'light', layout: 'split', collapseUnchanged: true, wrapLines: false }).unsafeCSS ?? '';

describe('pierreDiffOptions: the row of comments under a changed line', () => {
  it('keeps the surface the app gives every diff', () => {
    expect(css.startsWith(PIERRE_SURFACE_CSS)).toBe(true);
  });

  it("takes an added line's green and a removed line's red, from Pierre's own colors", () => {
    expect(css).toContain('[data-line][data-line-type=change-addition] + [data-line-annotation]:has(slot){--diffs-computed-decoration-bg:');
    expect(css).toContain('[data-line][data-line-type=change-deletion] + [data-line-annotation]:has(slot){--diffs-computed-decoration-bg:');
    expect(css).toContain('var(--diffs-addition-base)');
    expect(css).toContain('var(--diffs-deletion-base)');
  });

  it("tints only the side holding the comments: side by side, the other side's row is an empty buffer, with no slot", () => {
    // The rules styling a row itself: those whose selector ends at it.
    const rowRules = css.match(/\[data-line-annotation\][^{\s]*\{/g) ?? [];
    expect(rowRules).toHaveLength(2);
    for (const rule of rowRules) expect(rule).toContain(':has(slot)');
  });

  it("draws the gutter's change bar as a background, leaving Pierre's ::before to keep the gutter's width", () => {
    expect(css).toContain('+ [data-gutter-buffer=annotation]{');
    expect(css).toContain('background-size:4px 100%');
    expect(css).not.toContain('[data-gutter-buffer=annotation]::before');
  });
});
