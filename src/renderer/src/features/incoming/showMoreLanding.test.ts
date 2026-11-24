import { describe, expect, it } from 'vitest';
import { showMoreLanding } from './showMoreLanding';

describe('showMoreLanding', () => {
  // Read newest first: the page's newest comes right after the 200 read before, above them in the list, oldest on top.
  it('lands on the newest changeset of the page read, next to those shown before', () => {
    expect(showMoreLanding({ countBefore: 200, count: 400, loading: false, started: true })).toEqual({ kind: 'land', index: 200 });
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
