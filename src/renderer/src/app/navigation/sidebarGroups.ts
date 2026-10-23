import type { ViewDefinition } from './viewRegistry';

const GROUPS: ViewDefinition['group'][] = ['Workspace', 'History', 'Collaborate'];

/** The sidebar's groups of the views given, in order, each with its views; a group left with none isn't shown (a repository's Workspace). */
export function sidebarGroups(views: readonly ViewDefinition[]): { group: ViewDefinition['group']; views: ViewDefinition[] }[] {
  return GROUPS.map((group) => ({ group, views: views.filter((view) => view.group === group) })).filter(({ views: inGroup }) => inGroup.length > 0);
}
