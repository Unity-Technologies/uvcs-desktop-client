import { describe, expect, it } from 'vitest';
import { lineMarksCss } from './lineMarksCss';

const removed = (lineNumber: number) => ({ side: 'deletions' as const, lineNumber });
const added = (lineNumber: number) => ({ side: 'additions' as const, lineNumber });

describe('lineMarksCss', () => {
  it('is empty with nothing to mark', () => {
    expect(lineMarksCss({})).toBe('');
    expect(lineMarksCss({ preview: [], leaving: [], restoredAt: [] })).toBe('');
  });

  it('strikes the added lines a discard would remove and flags the removed ones it would bring back', () => {
    const css = lineMarksCss({ preview: [added(4), removed(3)] });
    expect(css).toContain('[data-line-type="change-addition"][data-line="4"]{text-decoration:line-through');
    expect(css).toContain('[data-line-type="change-deletion"][data-line="3"],[data-line-type="change-deletion"][data-column-number="3"]{box-shadow');
    expect(css).not.toContain('change-addition"][data-column-number');
  });

  it('fades out the lines being discarded, gutter included', () => {
    const css = lineMarksCss({ leaving: [added(7)] });
    expect(css).toContain('[data-line-type="change-addition"][data-line="7"],[data-line-type="change-addition"][data-column-number="7"]{animation:discard-leave');
  });

  it('lights the restored lines on the modified side only', () => {
    const css = lineMarksCss({ restoredAt: [2, 5] });
    expect(css).toContain(':is([data-additions],[data-unified]) :is([data-line="2"],[data-column-number="2"],[data-line="5"],[data-column-number="5"])');
  });

  it('keeps the other side from looking picked when the picked lines are all on one side', () => {
    expect(lineMarksCss({ pickedSide: 'additions' })).toBe('[data-deletions] [data-selected-line][data-selected-line]{--mix-selection-light:100%;--mix-selection-dark:100%}');
    expect(lineMarksCss({ pickedSide: 'deletions' })).toContain('[data-additions] [data-selected-line]');
  });

  it('only moves for whoever wants motion', () => {
    expect(lineMarksCss({ restoredAt: [1] })).toMatch(/^@media \(prefers-reduced-motion:no-preference\)\{.*discard-restored/);
  });
});
