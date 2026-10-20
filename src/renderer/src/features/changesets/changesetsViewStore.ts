import { createViewFilters } from '../../lib/viewFilters';
import { CHANGESET_SESSION_FILTERS, CLEARED_CHANGESET_FILTERS, DEFAULT_CHANGESET_FILTERS } from './changesetFilters';

export const useChangesetFilters = createViewFilters('changesets-view', DEFAULT_CHANGESET_FILTERS, CLEARED_CHANGESET_FILTERS, CHANGESET_SESSION_FILTERS);
