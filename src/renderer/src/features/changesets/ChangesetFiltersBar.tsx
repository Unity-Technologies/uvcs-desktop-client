import { CalendarDays, Check, ChevronDown, GitBranch, User } from 'lucide-react';
import { Button } from '../../ui/Button';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { SearchField } from '../../ui/SearchField';
import { DATE_PRESET_LABELS, type ChangesetFilterState, type DatePreset } from './changesetFilters';

interface ChangesetFiltersBarProps {
  filter: ChangesetFilterState;
  onChange: (filter: ChangesetFilterState) => void;
}

export function ChangesetFiltersBar({ filter, onChange }: ChangesetFiltersBarProps) {
  const update = (changes: Partial<ChangesetFilterState>): void => onChange({ ...filter, ...changes });
  const presets = Object.keys(DATE_PRESET_LABELS) as DatePreset[];

  return (
    <>
      <SearchField value={filter.search} onChange={(search) => update({ search })} placeholder="Search comment, author, branch or number" width={300} />
      <ActionDropdownMenu
        align="start"
        entries={presets.map((preset) => ({
          id: preset,
          label: DATE_PRESET_LABELS[preset],
          icon: preset === filter.datePreset ? Check : undefined,
          run: () => update({ datePreset: preset }),
        }))}
      >
        <Button variant="ghost" size="small" icon={<CalendarDays size={13} />}>
          {DATE_PRESET_LABELS[filter.datePreset]}
          <ChevronDown size={12} />
        </Button>
      </ActionDropdownMenu>
      <Button
        variant={filter.onlyMine ? 'secondary' : 'ghost'}
        size="small"
        icon={<User size={13} />}
        aria-pressed={filter.onlyMine}
        onClick={() => update({ onlyMine: !filter.onlyMine })}
      >
        Mine
      </Button>
      <Button
        variant={filter.onlyCurrentBranch ? 'secondary' : 'ghost'}
        size="small"
        icon={<GitBranch size={13} />}
        aria-pressed={filter.onlyCurrentBranch}
        onClick={() => update({ onlyCurrentBranch: !filter.onlyCurrentBranch })}
      >
        This branch
      </Button>
    </>
  );
}
