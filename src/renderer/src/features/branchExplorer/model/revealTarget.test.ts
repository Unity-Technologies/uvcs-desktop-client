import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import { nextRelaxation, resolveReveal } from './revealTarget';

const now = new Date(2026, 8, 25);
const open = { filtersActive: false, dateRange: 'month', showHiddenBranches: false } as const;

describe('resolveReveal', () => {
  const layout = layoutGraph(sampleHistory());

  it('finds changesets, branches and labels', () => {
    expect(resolveReveal({ kind: 'changeset', id: 4 }, layout)).toEqual({ kind: 'changeset', id: 4 });
    expect(resolveReveal({ kind: 'branch', name: '/main/a' }, layout)).toEqual({ kind: 'branch', name: '/main/a' });
    expect(resolveReveal({ kind: 'label', name: 'v1', changeset: 6 }, layout)).toEqual({ kind: 'changeset', id: 6 });
  });

  it('misses what the layout does not have', () => {
    expect(resolveReveal({ kind: 'changeset', id: 99 }, layout)).toBeNull();
    expect(resolveReveal({ kind: 'branch', name: '/main/gone' }, layout)).toBeNull();
    expect(resolveReveal({ kind: 'label', name: 'v2', changeset: 6 }, layout)).toBeNull();
  });
});

describe('nextRelaxation', () => {
  it('drops the filters first', () => {
    expect(nextRelaxation({ ...open, filtersActive: true }, '2020-01-01', now)).toEqual({ kind: 'clearFilters' });
  });

  it('then widens the dates just enough to reach the target', () => {
    expect(nextRelaxation(open, '2026-07-10', now)).toEqual({ kind: 'widenDates', dateRange: 'quarter' });
    expect(nextRelaxation(open, '2025-01-10', now)).toEqual({ kind: 'widenDates', dateRange: 'all' });
  });

  it('always widens past the current range, even when the date looks covered', () => {
    expect(nextRelaxation(open, '2026-09-20', now)).toEqual({ kind: 'widenDates', dateRange: 'quarter' });
  });

  it('loads all history when the date is unknown', () => {
    expect(nextRelaxation(open, undefined, now)).toEqual({ kind: 'widenDates', dateRange: 'all' });
  });

  it('then shows hidden branches, and finally gives up', () => {
    expect(nextRelaxation({ ...open, dateRange: 'all' }, undefined, now)).toEqual({ kind: 'showHidden' });
    expect(nextRelaxation({ ...open, dateRange: 'all', showHiddenBranches: true }, undefined, now)).toBeNull();
  });
});
