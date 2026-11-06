import { useMemo, useState } from 'react';
import { usePlaceServer } from '../../../app/workspace/useWorkspace';
import { PersonRow } from '../../../components/people/PersonRow';
import { matchesWordFilter } from '../../../lib/matchesAllWords';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { userFilterTexts } from '../../../lib/userName';
import { FilterChecklist } from '../../../ui/FilterChecklist';
import { useMemberNames } from '../../permissions/permissionsQueries';
import { offeredReviewers } from '../reviewers';
import { isPicked, pickerEmptyText, togglePicked, type ReviewerPick } from '../reviewerPick';

/** How long typing pauses before a server that can't list everyone is asked for the names typed. */
const SEARCH_PAUSE_MS = 300;

const NO_USERS: readonly string[] = [];

interface ReviewerPickerProps {
  pick: ReviewerPick;
  onPickChange: (pick: ReviewerPick) => void;
}

/**
 * The reviewers' popover: a field to find anyone on the server (`cm listusers`, read once and kept), the reviewers as
 * it opened checked at the top. Checking asks someone, unchecking takes them off; it all applies as the popover
 * closes. A server whose directory can't list everyone (an LDAP size limit) is asked for the names typed instead.
 */
export function ReviewerPicker({ pick, onPickChange }: ReviewerPickerProps) {
  const server = usePlaceServer() ?? '';
  const [search, setSearch] = useState('');
  const typed = useDebouncedValue(search.trim(), SEARCH_PAUSE_MS);
  const everyone = useMemberNames(server, 'user', { enabled: server !== '' });
  const listFailed = Boolean(everyone.error);
  const searched = useMemberNames(server, 'user', { filter: typed, enabled: listFailed && typed !== '' });
  const users = everyone.data ?? searched.data ?? NO_USERS;
  const offered = useMemo(() => offeredReviewers(users, pick.onOpen), [users, pick.onOpen]);
  const rows = useMemo(() => offered.filter((user) => matchesWordFilter(userFilterTexts(user), search)), [offered, search]);
  const loading = (everyone.isLoading && !listFailed) || searched.isFetching;

  return (
    <FilterChecklist
      rows={rows}
      search={search}
      onSearchChange={setSearch}
      placeholder="Find a user"
      label="Reviewers"
      isChecked={(user) => isPicked(pick, user)}
      onToggle={(user) => onPickChange(togglePicked(pick, user))}
      renderRow={(user) => <PersonRow user={user} />}
      empty={pickerEmptyText({ listFailed, loading, search })}
      footer={listFailed ? 'The server can’t list everyone: type a name to look it up.' : undefined}
    />
  );
}
