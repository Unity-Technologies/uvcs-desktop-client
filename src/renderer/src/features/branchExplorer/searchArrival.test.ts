import { describe, expect, it } from 'vitest';
import { awaitsFirstHit, goesToFirstHit, type SearchMoment } from './searchArrival';

/** The moment a typed query has stayed put, the graph has searched it, and it found one hit. */
const settledWithHits: SearchMoment = { typedSettled: true, searchCaughtUp: true, hitCount: 1 };

describe('awaitsFirstHit', () => {
  it('waits to go to the first hit of anything typed', () => {
    expect(awaitsFirstHit('282773')).toBe(true);
    expect(awaitsFirstHit(' fix crash ')).toBe(true);
  });

  it('never moves the view for a cleared search', () => {
    expect(awaitsFirstHit('')).toBe(false);
    expect(awaitsFirstHit('   ')).toBe(false);
  });
});

describe('goesToFirstHit', () => {
  it('goes to the first hit once the typed query settled and the graph found it', () => {
    expect(goesToFirstHit(true, settledWithHits)).toBe(true);
  });

  it('waits while the user is still typing', () => {
    expect(goesToFirstHit(true, { ...settledWithHits, typedSettled: false })).toBe(false);
  });

  it('waits while the hits shown are still those of an earlier query', () => {
    expect(goesToFirstHit(true, { ...settledWithHits, searchCaughtUp: false })).toBe(false);
  });

  it('waits while nothing matches, and goes once the graph finds a hit for the same query', () => {
    expect(goesToFirstHit(true, { ...settledWithHits, hitCount: 0 })).toBe(false);
    expect(goesToFirstHit(true, { ...settledWithHits, hitCount: 3 })).toBe(true);
  });

  it('goes only once per query: never again after it went or the user stepped, however the graph is panned or laid out', () => {
    expect(goesToFirstHit(false, settledWithHits)).toBe(false);
    expect(goesToFirstHit(false, { ...settledWithHits, hitCount: 5 })).toBe(false);
  });
});
