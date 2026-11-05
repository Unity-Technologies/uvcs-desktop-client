import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { CURRENT_BRANCH, pickedBranchFilters } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';
import { showPersonChangesets } from './showPersonChangesets';

function filtersShown() {
  const { text, people, since, onlyCurrentBranch, pickedBranch } = useChangesetFilters.getState();
  return { text, people, since, onlyCurrentBranch, pickedBranch };
}

describe("Show a person's changesets", () => {
  it('opens the Changesets view on their changesets alone, with no text or picked branch hiding some', () => {
    useChangesetFilters.getState().update({ text: 'fix', people: EVERYONE, since: 'lastWeek', onlyCurrentBranch: false, ...pickedBranchFilters(workspacePlace('/ws'), '/main/task') });

    showPersonChangesets('ana.diaz@acme.com', 'tom');

    expect(filtersShown()).toEqual({ text: '', people: { mine: false, others: ['ana.diaz@acme.com'] }, since: 'lastWeek', onlyCurrentBranch: false, pickedBranch: null });
    expect(whereTheWindowIs().view).toBe('changesets');
  });

  it('picks Mine for the user, and keeps the time range and "This branch" the view remembers', () => {
    useChangesetFilters.getState().update({ people: EVERYONE, since: 'lastMonth', ...CURRENT_BRANCH });

    showPersonChangesets('tom', 'tom');

    expect(filtersShown()).toMatchObject({ people: MINE, since: 'lastMonth', onlyCurrentBranch: true });
  });
});
