import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import type { GraphLayout } from './layoutGraph';
import { describeRevealTarget, nextRelaxation, resolveReveal, revealStep, type RevealLimits, type RevealStep, type RevealTarget } from './revealTarget';

const now = new Date(2026, 8, 25);
const open = { filtersActive: false, dateRange: 'lastMonth', showHiddenBranches: false } as const;

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
    expect(nextRelaxation(open, '2026-07-10', now)).toEqual({ kind: 'widenDates', dateRange: 'last3Months' });
    expect(nextRelaxation(open, '2025-01-10', now)).toEqual({ kind: 'widenDates', dateRange: 'anyTime' });
  });

  it('always widens past the current range, even when the date looks covered', () => {
    expect(nextRelaxation(open, '2026-09-20', now)).toEqual({ kind: 'widenDates', dateRange: 'last3Months' });
  });

  it('loads all history when the date is unknown', () => {
    expect(nextRelaxation(open, undefined, now)).toEqual({ kind: 'widenDates', dateRange: 'anyTime' });
  });

  it('then shows hidden branches, and finally gives up', () => {
    expect(nextRelaxation({ ...open, dateRange: 'anyTime' }, undefined, now)).toEqual({ kind: 'showHidden' });
    expect(nextRelaxation({ ...open, dateRange: 'anyTime', showHiddenBranches: true }, undefined, now)).toBeNull();
  });
});

describe('revealStep: a reveal from another view', () => {
  const everything = layoutGraph(sampleHistory());
  const history = sampleHistory();
  /** /main/a is a hidden branch: the graph draws it only with every filter off, all history and hidden branches shown. */
  const withoutA = layoutGraph({ ...history, branches: history.branches.filter((each) => each.name !== '/main/a'), changesets: history.changesets.filter((each) => each.branch !== '/main/a'), mergeLinks: [] });
  const graphFor = (limits: RevealLimits): GraphLayout => (!limits.filtersActive && limits.dateRange === 'anyTime' && limits.showHiddenBranches ? everything : withoutA);

  /** Relaxes as the view does, one step per settled graph, until the reveal ends; returns every step taken. */
  function reveal(target: RevealTarget, start: RevealLimits): RevealStep[] {
    const steps: RevealStep[] = [];
    let limits = start;
    for (let settled = 0; settled < 10; settled++) {
      const step = revealStep(target, graphFor(limits), limits, now);
      steps.push(step);
      if (step.kind === 'reveal' || step.kind === 'notInGraph') return steps;
      if (step.kind === 'clearFilters') limits = { ...limits, filtersActive: false };
      if (step.kind === 'widenDates') limits = { ...limits, dateRange: step.dateRange };
      if (step.kind === 'showHidden') limits = { ...limits, showHiddenBranches: true };
    }
    throw new Error('The reveal never ended');
  }

  it('shows what the graph already has without touching any filter', () => {
    expect(reveal({ kind: 'changeset', id: 3 }, { ...open, filtersActive: true })).toEqual([{ kind: 'reveal', hit: { kind: 'changeset', id: 3 } }]);
  });

  it('relaxes the filters, then the dates, then hidden branches, one step at a time until it shows', () => {
    expect(reveal({ kind: 'changeset', id: 5, date: '2025-01-10' }, { ...open, filtersActive: true })).toEqual([
      { kind: 'clearFilters' },
      { kind: 'widenDates', dateRange: 'anyTime' },
      { kind: 'showHidden' },
      { kind: 'reveal', hit: { kind: 'changeset', id: 5 } },
    ]);
  });

  it('says it is not there only once nothing is left to relax', () => {
    expect(reveal({ kind: 'branch', name: '/main/gone' }, open).map((step) => step.kind)).toEqual(['widenDates', 'showHidden', 'notInGraph']);
  });

  it('names what it looked for', () => {
    expect(describeRevealTarget({ kind: 'changeset', id: 12 })).toBe('Changeset 12');
    expect(describeRevealTarget({ kind: 'branch', name: '/main/task' })).toBe('Branch /main/task');
    expect(describeRevealTarget({ kind: 'label', name: 'v1.0', changeset: 3 })).toBe('Label v1.0');
  });
});
