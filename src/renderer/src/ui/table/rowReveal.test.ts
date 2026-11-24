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

  it('asks for nothing until a row is asked for', () => {
    expect(holdsNewValues([NO_ROW_REVEAL.key, NO_ROW_REVEAL.asked], [NO_ROW_REVEAL.key, NO_ROW_REVEAL.asked])).toBe(false);
    expect(revealAsked(NO_ROW_REVEAL, 'src/a.cs').asked).toBe(1);
  });
});
