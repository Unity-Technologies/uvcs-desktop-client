import { ALL_PROJECTS_COLOR } from '@shared/domain/organizations';
import type { UnityProject } from '@shared/domain/repository';
import { ProjectIcon } from '../../components/ProjectIcon';
import { holdsCount } from '../../lib/text';
import { PickFilter } from './PickFilter';
import { matchingProjects, type ProjectChoice } from './repositoryProjects';

interface ProjectFilterProps {
  choices: ProjectChoice[];
  /** Every repository of the organization, as "All projects" counts them. */
  repositoryCount: number;
  /** The project shown, none for all projects. */
  project: UnityProject | null;
  onChange: (project: string | null) => void;
}

const repositoriesIn = (count: number): string => holdsCount(count, 'repository', 'repositories');

/**
 * A Unity organization's project picker: all projects, or one found by name among the many an organization holds,
 * each with how many repositories it has.
 */
export function ProjectFilter({ choices, repositoryCount, project, onChange }: ProjectFilterProps) {
  return (
    <PickFilter
      trigger={{
        icon: project ? <ProjectIcon guid={project.guid} size={16} /> : <ProjectIcon color={ALL_PROJECTS_COLOR} size={16} />,
        label: project?.name ?? 'All projects',
      }}
      name="Project"
      rowsLabel="Projects"
      all={{ icon: <ProjectIcon color={ALL_PROJECTS_COLOR} />, label: 'All projects', detail: repositoriesIn(repositoryCount), picked: project === null }}
      choices={choices}
      matching={matchingProjects}
      rowOf={(choice) => ({
        key: choice.name,
        icon: <ProjectIcon guid={choice.guid} />,
        label: choice.name,
        detail: repositoriesIn(choice.repositoryCount),
        picked: choice.name === project?.name,
      })}
      placeholder="Find a project"
      empty="No matching projects"
      onPick={(picked) => onChange(picked?.name ?? null)}
    />
  );
}
