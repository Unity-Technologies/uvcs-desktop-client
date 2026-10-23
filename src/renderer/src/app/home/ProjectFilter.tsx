import { ALL_PROJECTS_COLOR } from '@shared/domain/organizations';
import type { UnityProject } from '@shared/domain/repository';
import { ProjectIcon } from '../../components/ProjectIcon';
import { PickFilter } from './PickFilter';
import { matchingProjects, type ProjectChoice } from './repositoryProjects';
import styles from './Home.module.css';

interface ProjectFilterProps {
  choices: ProjectChoice[];
  /** The project shown, none for all projects. */
  project: UnityProject | null;
  onChange: (project: string | null) => void;
}

/**
 * A Unity organization's project filter: all projects, or one found by name among the many an organization holds,
 * each with how many repositories it has.
 */
export function ProjectFilter({ choices, project, onChange }: ProjectFilterProps) {
  return (
    <PickFilter
      chip={{
        icon: project ? <ProjectIcon guid={project.guid} size={16} /> : <ProjectIcon color={ALL_PROJECTS_COLOR} size={16} />,
        label: project?.name ?? 'All projects',
        active: project !== null,
      }}
      name="Project"
      rowsLabel="Projects"
      all={{ label: <AllProjectsLabel />, checked: project === null }}
      choices={choices}
      matching={matchingProjects}
      rowOf={(choice) => ({
        key: choice.name,
        icon: <ProjectIcon guid={choice.guid} />,
        label: choice.name,
        count: choice.repositoryCount,
        picked: choice.name === project?.name,
      })}
      placeholder="Find a project"
      empty="No matching projects"
      onPick={(picked) => onChange(picked?.name ?? null)}
    />
  );
}

function AllProjectsLabel() {
  return (
    <span className={styles.pickChoice}>
      <ProjectIcon color={ALL_PROJECTS_COLOR} />
      All projects
    </span>
  );
}
