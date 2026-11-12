import { describe, expect, it } from 'vitest';
import type { IncomingSummary } from '@shared/domain/incoming';
import { incomingCount } from './incomingCount';

describe('incomingCount', () => {
  it('counts the changesets the branch has that the workspace lacks, stopped short past the check limit', () => {
    const summary: IncomingSummary = { branch: '/main', loadedChangeset: 10, headChangeset: 110, changesetCount: 100, countCapped: true, authors: [] };
    expect(incomingCount(summary)).toEqual({ count: 100, more: true });
  });

  it('counts the items the branch head brings a partial workspace', () => {
    expect(incomingCount({ branch: '/main', partial: true, headChangeset: 7, itemCount: 3 })).toEqual({ count: 3, more: false });
  });

  it('counts nothing off a branch or while unknown', () => {
    expect(incomingCount({ branch: null, changesetCount: 0, countCapped: false, authors: [] })).toEqual({ count: 0, more: false });
    expect(incomingCount(undefined)).toBeUndefined();
  });
});
