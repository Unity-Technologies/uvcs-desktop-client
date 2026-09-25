import { CalendarDays, GitBranch, User } from 'lucide-react';
import { ChoiceChip } from '../../ui/ChoiceChip';
import { SearchField } from '../../ui/SearchField';
import { ToggleChip } from '../../ui/ToggleChip';
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
      <ChoiceChip<DatePreset>
        value={filter.datePreset}
        choices={presets.map((preset) => ({ value: preset, label: DATE_PRESET_LABELS[preset] }))}
        onChange={(datePreset) => update({ datePreset })}
        icon={<CalendarDays size={13} />}
      />
      <ToggleChip pressed={filter.onlyMine} icon={<User size={13} />} onChange={(onlyMine) => update({ onlyMine })}>
        Mine
      </ToggleChip>
      <ToggleChip
        pressed={filter.onlyCurrentBranch}
        icon={<GitBranch size={13} />}
        onChange={(onlyCurrentBranch) => update({ onlyCurrentBranch })}
      >
        This branch
      </ToggleChip>
    </>
  );
}
