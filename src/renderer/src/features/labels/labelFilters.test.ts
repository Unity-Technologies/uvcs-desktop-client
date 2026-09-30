import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { compactFilter } from '../../lib/compactFilter';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { labelFilterTexts, labelsQuery } from './labelFilters';
import { useLabelsViewStore } from './labelsViewStore';

const today = new Date(2026, 8, 25);

describe('what Labels asks the server for', () => {
  it('asks for every label with the defaults, sharing the key of every other reader of all labels', () => {
    expect(compactFilter(labelsQuery({ since: 'anyTime', people: EVERYONE }, today))).toEqual({});
  });

  it('puts the time range and the people picked, sorted, into the query', () => {
    expect(labelsQuery({ since: 'lastWeek', people: { mine: true, others: ['zoe', 'ana'] } }, today)).toEqual({ sinceDate: '2026-09-18', owners: ['me', 'ana', 'zoe'] });
  });
});

describe('the labels filter', () => {
  const label = { name: 'v1.2', comment: 'Spring release', branch: '/main/release', owner: 'ana.diaz@unity3d.com' };
  const matches = (search: string) => matchesWordFilter(labelFilterTexts(label), search);

  it('looks through the name, comment, branch and creator as shown or stored', () => {
    expect(['v1.2', 'spring', 'main/release', 'Ana Diaz', 'ana.diaz@unity3d'].every(matches)).toBe(true);
    expect(matches('autumn')).toBe(false);
  });
});

describe("Labels' Clear filters", () => {
  it('shows everyone and empties the text, keeping the time range', () => {
    useLabelsViewStore.getState().update({ text: 'v1', people: MINE, since: 'lastYear' });

    useLabelsViewStore.getState().clear();

    const { text, people, since } = useLabelsViewStore.getState();
    expect({ text, people, since }).toEqual({ text: '', people: EVERYONE, since: 'lastYear' });
  });
});
