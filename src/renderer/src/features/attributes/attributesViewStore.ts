import { EVERYONE } from '../../lib/peopleFilter';
import { createViewFilters, type ViewFilters } from '../../lib/viewFilters';

export const useAttributesViewStore = createViewFilters<ViewFilters>('attributes-view', { text: '', people: EVERYONE });
