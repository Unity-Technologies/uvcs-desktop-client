import { EVERYONE } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { createViewFilters, type ViewFilters } from '../../lib/viewFilters';

interface LabelsFilters extends ViewFilters {
  since: SincePreset;
}

export const useLabelsViewStore = createViewFilters<LabelsFilters>('labels-view', { text: '', people: EVERYONE, since: 'anyTime' });
