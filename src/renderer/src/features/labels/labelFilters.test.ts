import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { compactFilter } from '../../lib/compactFilter';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { labelChoices, labelFilterTexts, labelsQuery } from './labelFilters';
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

describe('the labels a label picker offers', () => {
  const label = (id: number, name: string) => ({ id, name, changeset: id, branch: '/main', comment: 'Not looked at', owner: 'ana', date: '2026-09-01T10:00:00', repository: 'game' });
  const labels = [label(1, 'BL001'), label(2, 'BL002'), label(3, 'RC-1 spring')];
  const names = (exclude: string | undefined, search: string) => labelChoices(labels, exclude, search).map((choice) => choice.name);

  it('offers every label but the one being compared, in order', () => {
    expect(names('BL002', '')).toEqual(['BL001', 'RC-1 spring']);
  });

  it('finds them by the words of their name typed, in any order, and by nothing else', () => {
    expect(names(undefined, 'spring rc')).toEqual(['RC-1 spring']);
    expect(names(undefined, 'bl00')).toEqual(['BL001', 'BL002']);
    expect(names(undefined, 'looked')).toEqual([]);
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
