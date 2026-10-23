import type { Place } from '@shared/domain/place';
import { viewsOf, type ViewDefinition } from './viewRegistry';

const GROUPS: ViewDefinition['group'][] = ['Workspace', 'History', 'Collaborate'];

/**
 * The sidebar's groups of the place's views (`viewsOf`), in order, each with its label and views; a group left with
 * none isn't shown. A repository explored without a workspace calls its first group, its Files alone, "Repository".
 */
export function sidebarGroups(place: Place): { label: string; views: ViewDefinition[] }[] {
  const views = viewsOf(place);
  return GROUPS.map((group) => ({ label: group === 'Workspace' && place.kind === 'repository' ? 'Repository' : group, views: views.filter((view) => view.group === group) })).filter(
    ({ views: inGroup }) => inGroup.length > 0,
  );
}
