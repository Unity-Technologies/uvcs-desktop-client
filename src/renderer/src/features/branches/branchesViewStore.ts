import { EVERYONE } from '../../lib/peopleFilter';
import type { SincePreset } from '../../lib/sincePresets';
import { createViewFilters, type ViewFilters } from '../../lib/viewFilters';

export type BranchesLayout = 'list' | 'tree';

interface BranchesFilters extends ViewFilters {
  since: SincePreset;
  /** Adds the hidden branches: it shows more, so "Clear filters" leaves it. */
  showHidden: boolean;
  layout: BranchesLayout;
}

export const useBranchesViewStore = createViewFilters<BranchesFilters>('branches-view', { text: '', people: EVERYONE, since: 'anyTime', showHidden: false, layout: 'list' });
