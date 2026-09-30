import { describe, expect, it } from 'vitest';
import { switchApproach } from './switchApproach';

const summary = { pendingCount: 2, privateCount: 0, unchangedCheckoutsOnly: false, inMerge: false };

describe('switchApproach', () => {
  it('switches as is with nothing pending, private files aside', () => {
    expect(switchApproach({ ...summary, pendingCount: 0, privateCount: 3 })).toBe('switchAsIs');
  });

  it('undoes checkouts that hold no change without asking', () => {
    expect(switchApproach({ ...summary, unchangedCheckoutsOnly: true })).toBe('undoUnchangedCheckouts');
  });

  it('refuses an unfinished merge before anything else, even of checkouts alone', () => {
    expect(switchApproach({ ...summary, inMerge: true })).toBe('refuseMerge');
    expect(switchApproach({ ...summary, inMerge: true, unchangedCheckoutsOnly: true })).toBe('refuseMerge');
  });

  it('shelves any other change, as the user chooses', () => {
    expect(switchApproach(summary)).toBe('shelveChanges');
  });
});
