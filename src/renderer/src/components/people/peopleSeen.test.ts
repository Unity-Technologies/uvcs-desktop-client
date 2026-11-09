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

  it('tells everyone the place’s lists showed, each once', () => {
    const seen = createPeopleSeen();
    seen.remember('/work/game', 'changesets', ['ana', 'ben']);
    seen.remember('/work/game', 'labels', ['ben', 'dora']);
    seen.remember('/work/web', 'changesets', ['carl']);

    expect(seen.everyone('/work/game')).toEqual(['ana', 'ben', 'dora']);
  });
});
