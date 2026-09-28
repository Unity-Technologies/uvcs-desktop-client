import { EVERYONE } from '../../lib/peopleFilter';
import { createViewFilters, type ViewFilters } from '../../lib/viewFilters';

export const useLocksViewStore = createViewFilters<ViewFilters>('locks-view', { text: '', people: EVERYONE });
