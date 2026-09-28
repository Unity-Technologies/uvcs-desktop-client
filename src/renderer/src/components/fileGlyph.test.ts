import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FAMILY_GLYPHS } from './fileGlyph';

/** What ItemIcon.module.css keeps neutral in a glyph: its outline of the page, known by its corners, and its fold. */
const PAGE_OUTLINE = (d: string): boolean =>
  ['2.4 2.4', 'a2 2 0 0 1 2-2h', 'a2 2 0 0 1-2 2h'].some((corner) => d.includes(corner)) || d.startsWith('M14 2v5');

const glyphs = Object.entries(FAMILY_GLYPHS).flatMap(([family, glyph]) => (glyph ? [[family, glyph] as const] : []));

describe('FAMILY_GLYPHS', () => {
  it.each(glyphs)('%s: its page outline is found, so only its glyph takes the tint', (_family, glyph) => {
    const svg = renderToStaticMarkup(createElement(glyph));
    const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]!);
    const shapes = (svg.match(/<(circle|rect)/g) ?? []).length;
    const outline = paths.filter(PAGE_OUTLINE);
    expect(outline.length).toBeGreaterThanOrEqual(2);
    // The glyph itself: whatever isn't the page.
    expect(paths.length - outline.length + shapes).toBeGreaterThan(0);
  });
});
