import { Box } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  project: string | null;
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
        <MenuChip icon={<Box size={13} />} active={project !== null} aria-label={`Project: ${project ?? 'All projects'}`}>
          <span className={styles.projectChipName}>{project ?? 'All projects'}</span>
        </MenuChip>
      }
    >
      <FilterOptions label="Projects" kind="radio" options={[{ id: 'all', label: 'All projects', checked: project === null, onSelect: () => choose(null) }]} />
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
          <span className={styles.projectChoice} data-picked={choice.name === project}>
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
