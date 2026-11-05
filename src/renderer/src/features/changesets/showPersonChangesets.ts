import { navigation } from '../../app/navigation/navigationStore';
import { onlyPerson } from '../../lib/peopleFilter';
import { ALL_BRANCHES } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';

/**
 * The Changesets view on one person's changesets, on every branch, from a person picked in the palette (`@`): the
 * people filter on them alone, as the view's own picker picks them (`onlyPerson`, Mine for the user), with no text,
 * "This branch" or branch picked by name hiding some. The time range stays as the view remembers it, and its chip
 * shows it.
 */
export function showPersonChangesets(person: string, me: string | undefined): void {
  useChangesetFilters.getState().update({ ...ALL_BRANCHES, text: '', people: onlyPerson(person, me) });
  navigation.goToView('changesets');
}
