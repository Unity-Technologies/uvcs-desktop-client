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
    useChangesetFilters.getState().update({ ...pickedBranchFilters(workspacePlace('/ws'), '/main/task'), text: 'fix', people: EVERYONE, since: 'lastWeek', onlyCurrentBranch: false });

    showPersonChangesets('ana.diaz@acme.com', 'tom');

    expect(filtersShown()).toEqual({ text: '', people: { mine: false, others: ['ana.diaz@acme.com'] }, since: 'lastWeek', onlyCurrentBranch: false, pickedBranch: null });
    expect(whereTheWindowIs().view).toBe('changesets');
  });

  it('shows them on every branch, "This branch" off, and keeps the time range the view remembers', () => {
    useChangesetFilters.getState().update({ people: EVERYONE, since: 'lastMonth', ...CURRENT_BRANCH });

    showPersonChangesets('ana.diaz', 'tom');

    expect(filtersShown()).toMatchObject({ since: 'lastMonth', onlyCurrentBranch: false, pickedBranch: null });
  });

  it('picks Mine for the user', () => {
    showPersonChangesets('tom', 'tom');

    expect(filtersShown().people).toEqual(MINE);
  });
});
