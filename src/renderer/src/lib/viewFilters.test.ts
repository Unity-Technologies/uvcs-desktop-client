import { describe, expect, it } from 'vitest';
import { EVERYONE, MINE } from './peopleFilter';
import { clearedFilters, isFiltering, rememberedFilters, restoredFilters } from './viewFilters';

const DEFAULTS = { text: '', people: EVERYONE, since: 'lastMonth', status: 'any', layout: 'list' };

describe('isFiltering', () => {
  it('is off with nothing typed, everyone, and the kinds as cleared', () => {
    expect(isFiltering(DEFAULTS, { status: 'any' })).toBe(false);
  });

  it('is on with text, people or a kind narrowing the list, but not for the time range', () => {
    expect(isFiltering({ ...DEFAULTS, text: 'fix' })).toBe(true);
    expect(isFiltering({ ...DEFAULTS, text: '  ' })).toBe(false);
    expect(isFiltering({ ...DEFAULTS, people: MINE })).toBe(true);
    expect(isFiltering({ ...DEFAULTS, status: 'Open' }, { status: 'any' })).toBe(true);
    expect(isFiltering({ ...DEFAULTS, since: 'anyTime' }, { status: 'any' })).toBe(false);
  });
});

describe('clearedFilters', () => {
  it('empties the text, shows everyone and resets the kinds', () => {
    expect(clearedFilters<typeof DEFAULTS>({ status: 'any' })).toEqual({ status: 'any', text: '', people: EVERYONE });
  });
});

describe('rememberedFilters', () => {
  it('keeps the options and Mine, not the text, the people by name or the actions', () => {
    const state = { ...DEFAULTS, text: 'fix', people: { mine: true, others: ['ana'] }, update: () => undefined };
    expect(rememberedFilters(state)).toEqual({ people: MINE, since: 'lastMonth', status: 'any', layout: 'list' });
  });
});

describe('restoredFilters', () => {
  it('turns the old Mine chip into the people filter', () => {
    expect(restoredFilters({ onlyMine: true, since: 'lastYear', layout: 'tree' }, DEFAULTS)).toEqual({ people: MINE, since: 'lastYear', layout: 'tree' });
  });

  it("reads the Branch Explorer's former date ranges, and drops what the view no longer has", () => {
    expect(restoredFilters({ since: 'quarter', gone: 1, layout: 3 }, DEFAULTS)).toEqual({ since: 'last3Months' });
    expect(restoredFilters({ since: 'fortnight' }, DEFAULTS)).toEqual({ since: 'lastMonth' });
  });

  it('never restores people picked by name', () => {
    expect(restoredFilters({ people: { mine: false, others: ['ana'] } }, DEFAULTS)).toEqual({ people: EVERYONE });
    expect(restoredFilters(null, DEFAULTS)).toEqual({});
  });
});
