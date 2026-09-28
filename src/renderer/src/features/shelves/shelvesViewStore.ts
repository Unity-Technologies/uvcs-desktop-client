import { MINE } from '../../lib/peopleFilter';
import { createViewFilters, type ViewFilters } from '../../lib/viewFilters';

/** Starts on the user's own shelves, as the list in Changes does; "All shelves" there hands its scope and text over. */
export const useShelvesViewStore = createViewFilters<ViewFilters>('shelves-view', { text: '', people: MINE });
