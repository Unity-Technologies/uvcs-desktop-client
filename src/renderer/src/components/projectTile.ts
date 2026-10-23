import { projectColor, type ProjectColor } from '@shared/domain/organizations';

/**
 * The fill of a project's tile (`ProjectIcon`): its own color once its GUID is read, else neutral, never a color it may
 * not have. A color named outright ("All projects" is indigo) as it is.
 */
export function projectTileFill(project: { guid: string | undefined } | { color: ProjectColor }): string {
  if ('color' in project) return `var(--project-${project.color})`;
  return project.guid === undefined ? 'var(--project-unknown)' : `var(--project-${projectColor(project.guid)})`;
}
