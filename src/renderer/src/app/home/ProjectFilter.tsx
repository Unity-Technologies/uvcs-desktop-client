import { ALL_PROJECTS_COLOR } from '@shared/domain/organizations';
import type { UnityProject } from '@shared/domain/repository';
import { ProjectIcon } from '../../components/ProjectIcon';
import { PickFilter } from './PickFilter';
import { matchingProjects } from './repositoryProjects';

interface ProjectFilterProps {
  projects: UnityProject[];
  /** The project shown, none for all projects. */
  project: UnityProject | null;
  onChange: (project: string | null) => void;
}

/** A Unity organization's project picker: all projects, or one found by name among the many an organization holds. */
export function ProjectFilter({ projects, project, onChange }: ProjectFilterProps) {
  return (
    <PickFilter
      trigger={{
        icon: project ? <ProjectIcon guid={project.guid} size={16} /> : <ProjectIcon color={ALL_PROJECTS_COLOR} size={16} />,
        label: project?.name ?? 'All projects',
      }}
      name="Project"
      rowsLabel="Projects"
      all={{ icon: <ProjectIcon color={ALL_PROJECTS_COLOR} />, label: 'All projects', picked: project === null }}
      choices={projects}
      matching={matchingProjects}
      rowOf={(choice) => ({ key: choice.name, icon: <ProjectIcon guid={choice.guid} />, label: choice.name, picked: choice.name === project?.name })}
      placeholder="Find a project"
      empty="No matching projects"
      onPick={(picked) => onChange(picked?.name ?? null)}
    />
  );
}
