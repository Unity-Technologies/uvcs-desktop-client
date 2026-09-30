import { describe, expect, it } from 'vitest';
import { createPeopleSeen } from './peopleSeen';

describe('peopleSeen', () => {
  it('keeps offering the people a list showed before, once the server reads only the ones picked', () => {
    const seen = createPeopleSeen();
    seen.remember('/work/game', 'changesets', ['ana', 'ben', 'ana']);

    expect(seen.remember('/work/game', 'changesets', ['ben'])).toEqual(['ana', 'ben']);
  });

  it('keeps each list and each workspace to the people it showed', () => {
    const seen = createPeopleSeen();
    seen.remember('/work/game', 'changesets', ['ana']);
    seen.remember('/work/web', 'changesets', ['carl']);

    expect(seen.remember('/work/game', 'labels', ['dora'])).toEqual(['dora']);
    expect(seen.remember('/work/game', 'changesets', [])).toEqual(['ana']);
  });
});
