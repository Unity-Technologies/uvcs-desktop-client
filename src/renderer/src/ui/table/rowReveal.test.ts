import { describe, expect, it } from 'vitest';
import { holdsNewValues } from '../../lib/useNewValuesEffect';
import { NO_ROW_REVEAL, revealAsked } from './rowReveal';

describe('revealAsked', () => {
  it('asks for the same row again as a new request, which the table shows again', () => {
    const first = revealAsked(NO_ROW_REVEAL, 'src/a.cs');
    const again = revealAsked(first, 'src/a.cs');

    expect(again).toEqual({ key: 'src/a.cs', asked: 2 });
    expect(holdsNewValues([first.key, first.asked], [again.key, again.asked])).toBe(true);
  });

  it('asks nothing new while no row is asked for: a view shown again keeps its scroll', () => {
    const first = revealAsked(NO_ROW_REVEAL, 'src/a.cs');

    expect(holdsNewValues([first.key, first.asked], [first.key, first.asked])).toBe(false);
  });
});
