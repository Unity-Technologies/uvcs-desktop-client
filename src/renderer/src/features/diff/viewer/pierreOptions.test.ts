import { describe, expect, it } from 'vitest';
import { PIERRE_SURFACE_CSS, pierreDiffOptions, pierreSnippetDiffOptions, WORD_MARKS } from './pierreOptions';

const css = pierreDiffOptions({ theme: 'light', layout: 'split', collapseUnchanged: true, wrapLines: false }).unsafeCSS ?? '';

describe('PIERRE_SURFACE_CSS: how code reads in every diff', () => {
  it("shows code at 12px, the classic desktop client's size, not Pierre's 13px", () => {
    expect(PIERRE_SURFACE_CSS).toContain('--diffs-font-size:12px');
  });

  it('leaves the line height to Pierre: its virtualizer counts on 20px lines', () => {
    expect(PIERRE_SURFACE_CSS).not.toContain('--diffs-line-height');
  });
});

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

describe('pierreSnippetDiffOptions: a few lines of diff in a comment', () => {
  const options = pierreSnippetDiffOptions('dark');

  it("reads as the code's diff: its theme, bars and word marks, in one column", () => {
    expect(options).toMatchObject({ theme: 'pierre-dark', themeType: 'dark', diffStyle: 'unified', diffIndicators: 'bars', ...WORD_MARKS });
  });

  it('shows every line, unnumbered, with no header, scrolling long lines sideways', () => {
    expect(options).toMatchObject({ expandUnchanged: true, disableLineNumbers: true, disableFileHeader: true, overflow: 'scroll' });
  });

  it('draws on the surface every diff does', () => {
    expect(options.unsafeCSS?.startsWith(PIERRE_SURFACE_CSS)).toBe(true);
  });

  it("runs its rows edge to edge, with no gap above the first or under the last, unlike the code's diff", () => {
    expect(options.unsafeCSS).toContain('--diffs-gap-block:0px');
    expect(pierreDiffOptions({ theme: 'dark', layout: 'unified', collapseUnchanged: false, wrapLines: false }).unsafeCSS).not.toContain('--diffs-gap-block');
  });
});
