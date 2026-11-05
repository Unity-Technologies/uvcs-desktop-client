import { navigation } from '../../app/navigation/navigationStore';
import { onlyPerson } from '../../lib/peopleFilter';
import { useChangesetFilters } from './changesetsViewStore';

/**
 * The Changesets view on one person's changesets, from a person picked in the palette (`@`): the people filter on
 * them alone, as the view's own picker picks them (`onlyPerson`, Mine for the user), with no text or branch picked by
 * name hiding some. The time range and "This branch" stay as the view remembers them, and its chips show them.
 */
export function showPersonChangesets(person: string, me: string | undefined): void {
  useChangesetFilters.getState().update({ text: '', pickedBranch: null, people: onlyPerson(person, me) });
  navigation.goToView('changesets');
}
