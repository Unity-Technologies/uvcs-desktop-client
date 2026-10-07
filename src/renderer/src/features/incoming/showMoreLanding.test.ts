import { describe, expect, it } from 'vitest';
import { showMoreLanding } from './showMoreLanding';

describe('showMoreLanding', () => {
  it('lands on the first changeset of the page read, after "All incoming changes" and those shown before', () => {
    expect(showMoreLanding({ countBefore: 200, count: 400, loading: false, started: true })).toEqual({ kind: 'land', index: 201 });
  });

  it('waits while the page is being read', () => {
    expect(showMoreLanding({ countBefore: 200, count: 200, loading: true, started: true })).toEqual({ kind: 'wait' });
  });

  it('waits until the read starts, which comes a render after the key', () => {
    expect(showMoreLanding({ countBefore: 200, count: 200, loading: false, started: false })).toEqual({ kind: 'wait' });
  });

  it('gives up when the read ended without a new page, so a later click lands nowhere', () => {
    expect(showMoreLanding({ countBefore: 200, count: 200, loading: false, started: true })).toEqual({ kind: 'cancel' });
  });
});
