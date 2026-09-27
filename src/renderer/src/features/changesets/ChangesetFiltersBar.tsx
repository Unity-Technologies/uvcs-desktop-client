import { CalendarDays, GitBranch, User } from 'lucide-react';
import { ChoiceChip } from '../../ui/ChoiceChip';
import { SearchField } from '../../ui/SearchField';
import { ToggleChip } from '../../ui/ToggleChip';
import { DATE_PRESET_LABELS, type ChangesetFilterState, type DatePreset } from './changesetFilters';

interface ChangesetFiltersBarProps {
  filter: ChangesetFilterState;
  onChange: (filter: ChangesetFilterState) => void;
  /** The branch the workspace is on; "This branch" shows only while it's on one. */
  currentBranch: string | undefined;
}

export function ChangesetFiltersBar({ filter, onChange, currentBranch }: ChangesetFiltersBarProps) {
  const update = (changes: Partial<ChangesetFilterState>): void => onChange({ ...filter, ...changes });
  const presets = Object.keys(DATE_PRESET_LABELS) as DatePreset[];

  return (
    <>
      <SearchField value={filter.search} onChange={(search) => update({ search })} placeholder="Filter by comment, author, changeset, branch" width={320} />
      <ChoiceChip<DatePreset>
        value={filter.datePreset}
        choices={presets.map((preset) => ({ value: preset, label: DATE_PRESET_LABELS[preset] }))}
        onChange={(datePreset) => update({ datePreset })}
        icon={<CalendarDays size={13} />}
      />
      <ToggleChip pressed={filter.onlyMine} icon={<User size={13} />} onChange={(onlyMine) => update({ onlyMine })}>
        Mine
      </ToggleChip>
      {currentBranch && (
        <ToggleChip pressed={filter.onlyCurrentBranch} icon={<GitBranch size={13} />} onChange={(onlyCurrentBranch) => update({ onlyCurrentBranch })}>
          This branch
        </ToggleChip>
      )}
    </>
  );
}
