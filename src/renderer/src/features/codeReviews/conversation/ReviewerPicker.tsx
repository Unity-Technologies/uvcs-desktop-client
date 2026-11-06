import type { MemberKind } from '@shared/domain/member';
import { useMemo, useState } from 'react';
import { usePlaceServer } from '../../../app/workspace/useWorkspace';
import { PersonRow } from '../../../components/people/PersonRow';
import { matchesWordFilter } from '../../../lib/matchesAllWords';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { FilterChecklist } from '../../../ui/FilterChecklist';
import { useMemberNames } from '../../permissions/permissionsQueries';
import { reviewerFilterTexts, reviewerGroups } from '../reviewerGroups';
import { isPicked, pickedKind, pickerEmptyText, pickOffered, togglePicked, type ReviewerPick } from '../reviewerPick';
import { GroupRow } from '../../../components/people/GroupRow';

/** How long typing pauses before a server that can't list everyone is asked for the names typed. */
const SEARCH_PAUSE_MS = 300;

const NO_NAMES: readonly string[] = [];

interface ReviewerPickerProps {
  pick: ReviewerPick;
  onPickChange: (pick: ReviewerPick) => void;
}

/**
 * The reviewers' checklist: a field to find any user or group on the server (`cm listusers --onlyusers` and
 * `--onlygroups`, each read once and kept), the reviewers as it opened checked at the top, then the groups, then the
 * users. Checking asks someone, unchecking takes them off; whoever shows it applies the pick (`pickChanges`). A server
 * whose directory can't list everyone (an LDAP size limit) is asked for the names typed instead.
 */
export function ReviewerPicker({ pick, onPickChange }: ReviewerPickerProps) {
  const server = usePlaceServer() ?? '';
  const [search, setSearch] = useState('');
  const typed = useDebouncedValue(search.trim(), SEARCH_PAUSE_MS);
  const users = useServerMembers(server, 'user', typed);
  const groups = useServerMembers(server, 'group', typed);
  const listFailed = users.listFailed || groups.listFailed;
  const groupSet = useMemo(() => reviewerGroups(groups.names), [groups.names]);
  const offered = useMemo(() => pickOffered(pick, { users: users.names, groups: groups.names }), [pick, users.names, groups.names]);
  const rows = useMemo(() => offered.filter((name) => matchesWordFilter(reviewerFilterTexts(name, groupSet), search)), [offered, groupSet, search]);

  return (
    <FilterChecklist
      rows={rows}
      search={search}
      onSearchChange={setSearch}
      placeholder="Find a user or group"
      label="Reviewers"
      isChecked={(name) => isPicked(pick, name)}
      onToggle={(name) => onPickChange(togglePicked(pick, { name, kind: pickedKind(pick, name, groupSet) }))}
      renderRow={(name) => (pickedKind(pick, name, groupSet) === 'group' ? <GroupRow group={name} /> : <PersonRow user={name} />)}
      empty={pickerEmptyText({ listFailed, loading: users.loading || groups.loading, search })}
      footer={listFailed ? 'The server can’t list everyone: type a name to look it up.' : undefined}
    />
  );
}

/** The server's users or groups: the whole list, or, where it can't be read, those matching what was typed. */
function useServerMembers(server: string, kind: MemberKind, typed: string) {
  const everyone = useMemberNames(server, kind, { enabled: server !== '' });
  const listFailed = Boolean(everyone.error);
  const searched = useMemberNames(server, kind, { filter: typed, enabled: listFailed && typed !== '' });
  return {
    names: everyone.data ?? searched.data ?? NO_NAMES,
    listFailed,
    loading: (everyone.isLoading && !listFailed) || searched.isFetching,
  };
}
