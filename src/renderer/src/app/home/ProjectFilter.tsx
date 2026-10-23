import { useMemo, useState } from 'react';
import { ALL_PROJECTS_COLOR } from '@shared/domain/organizations';
import type { UnityProject } from '@shared/domain/repository';
import { ProjectIcon } from '../../components/ProjectIcon';
import { formatCount } from '../../lib/text';
import { FilterOptions } from '../../ui/FilterOptions';
import { FilterPopover } from '../../ui/FilterPopover';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { MenuChip } from '../../ui/ToggleChip';
import { matchingProjects, type ProjectChoice } from './repositoryProjects';
import styles from './Home.module.css';

const ROW_HEIGHT = 32;

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const shown = useMemo(() => matchingProjects(choices, search), [choices, search]);
  const choose = (picked: string | null): void => {
    setOpen(false);
    setSearch('');
    onChange(picked);
  };

  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      width={320}
      trigger={
        <MenuChip icon={project ? <ProjectIcon guid={project.guid} size={16} /> : <ProjectIcon color={ALL_PROJECTS_COLOR} size={16} />} active={project !== null} aria-label={`Project: ${project?.name ?? 'All projects'}`}>
          <span className={styles.projectChipName}>{project?.name ?? 'All projects'}</span>
        </MenuChip>
      }
    >
      <FilterOptions label="Projects" kind="radio" options={[{ id: 'all', label: <AllProjectsLabel />, checked: project === null, onSelect: () => choose(null) }]} />
      <PickList
        items={shown}
        itemKey={(choice) => choice.name}
        search={search}
        onSearchChange={setSearch}
        placeholder="Find a project"
        label="Projects"
        onPick={(choice) => choose(choice.name)}
        rowHeight={ROW_HEIGHT}
        empty="No matching projects"
        renderItem={(choice) => (
          <span className={styles.projectChoice} data-picked={choice.name === project?.name}>
            <ProjectIcon guid={choice.guid} />
            <span className={styles.projectChoiceName}>
              <Highlight text={choice.name} />
            </span>
            <span className={styles.projectChoiceCount}>{formatCount(choice.repositoryCount)}</span>
          </span>
        )}
      />
    </FilterPopover>
  );
}

function AllProjectsLabel() {
  return (
    <span className={styles.projectChoice}>
      <ProjectIcon color={ALL_PROJECTS_COLOR} />
      All projects
    </span>
  );
}
