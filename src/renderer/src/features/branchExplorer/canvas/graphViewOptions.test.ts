import { describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_VIEW_OPTIONS, GRAPH_VIEW_OPTION_GROUPS, graphViewOptionsOf, hidesAnything } from './graphViewOptions';

describe('GRAPH_VIEW_OPTION_GROUPS', () => {
  it('lists every display option exactly once', () => {
    const listed = GRAPH_VIEW_OPTION_GROUPS.flatMap((group) => group.options.map((entry) => entry.option));
    expect([...listed].sort()).toEqual(Object.keys(DEFAULT_GRAPH_VIEW_OPTIONS).sort());
  });
});

describe('graphViewOptionsOf', () => {
  it('keeps only the display options', () => {
    const preferences = { ...DEFAULT_GRAPH_VIEW_OPTIONS, showLabels: false, dateRange: 'lastWeek' };
    expect(graphViewOptionsOf(preferences)).toEqual({ ...DEFAULT_GRAPH_VIEW_OPTIONS, showLabels: false });
  });
});

describe('hidesAnything', () => {
  it('is false while everything shows', () => {
    expect(hidesAnything(DEFAULT_GRAPH_VIEW_OPTIONS)).toBe(false);
  });

  it('is true once any option is off', () => {
    expect(hidesAnything({ ...DEFAULT_GRAPH_VIEW_OPTIONS, branchColors: false })).toBe(true);
  });
});
