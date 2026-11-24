import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MERGE_REQUEST_STATE_ICONS } from '../../codeReviews/mergeRequestState';
import { REVIEW_STATUS_ICONS } from '../../codeReviews/reviewStatusIcons';
import { Check, CircleDot, X } from 'lucide-react';
import { STATE_GLYPHS, STATUS_GLYPHS, VERDICT_GLYPHS, type Glyph } from './lucideGlyphs';

/** The shapes of an icon as the app shows it, from its markup, in order. */
function shapesOf(icon: ComponentType): string[] {
  const markup = renderToStaticMarkup(createElement(icon));
  return [...markup.matchAll(/<(circle|line|path)\s([^>]*?)\/?>/g)].map(([, tag, attributes]) => `${tag} ${sortedAttributes(attributes!)}`);
}

function sortedAttributes(attributes: string): string {
  return [...attributes.matchAll(/(\w+)="([^"]*)"/g)]
    .map(([, name, value]) => `${name}=${value}`)
    .sort()
    .join(' ');
}

function shapesOfGlyph(glyph: Glyph): string[] {
  return glyph.map(([tag, attributes]) => `${tag} ${Object.entries(attributes).map(([name, value]) => `${name}=${value}`).sort().join(' ')}`);
}

describe('the canvas glyphs', () => {
  it.each(Object.keys(STATE_GLYPHS) as (keyof typeof STATE_GLYPHS)[])("draw the %s state's icon as the app shows it", (state) => {
    expect(shapesOfGlyph(STATE_GLYPHS[state])).toEqual(shapesOf(MERGE_REQUEST_STATE_ICONS[state]));
  });

  it.each(Object.keys(STATUS_GLYPHS) as (keyof typeof STATUS_GLYPHS)[])("draw the %s status's icon as the app shows it", (status) => {
    expect(shapesOfGlyph(STATUS_GLYPHS[status])).toEqual(shapesOf(REVIEW_STATUS_ICONS[status]));
  });

  it("draw the verdicts' icons as the app shows them", () => {
    expect(shapesOfGlyph(VERDICT_GLYPHS.ready)).toEqual(shapesOf(Check));
    expect(shapesOfGlyph(VERDICT_GLYPHS.blocked)).toEqual(shapesOf(X));
    expect(shapesOfGlyph(VERDICT_GLYPHS.waiting)).toEqual(shapesOf(CircleDot));
  });
});
