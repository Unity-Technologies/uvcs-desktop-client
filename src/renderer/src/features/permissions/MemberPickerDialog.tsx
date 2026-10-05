import { useId, useState, type KeyboardEvent } from 'react';
import type { MemberRef } from '@shared/domain/permissions';
import { navigationTarget } from '../../lib/listNavigation';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { memberCandidates, type MemberCandidate } from './memberCandidates';
import { MemberIcon } from './MemberIcon';
import { useMemberNames } from './permissionsQueries';
import styles from './MemberPickerDialog.module.css';

interface PickMemberOptions {
  server: string;
  title: string;
  description?: string;
  /** Members already listed, offered but not picked again. */
  listed?: ReadonlySet<string>;
  /** Offer `ALL USERS` and `OWNER` too. */
  specials?: boolean;
}

/** Asks for a user or group of the server. Resolves to it, or undefined if dismissed. */
export function pickMember(options: PickMemberOptions): Promise<MemberRef | undefined> {
  return askDialog<MemberRef>((finish) => <MemberPickerDialog {...options} finish={finish} />);
}

/** How long typing pauses before a server that can't list everyone is asked for the names typed. */
const SEARCH_PAUSE_MS = 300;

function MemberPickerDialog({ server, title, description, listed = new Set(), specials = false, finish }: PickMemberOptions & { finish: (member: MemberRef | undefined) => void }) {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const typed = useDebouncedValue(search.trim(), SEARCH_PAUSE_MS);
  const users = useMemberNames(server, 'user');
  const groups = useMemberNames(server, 'group');
  // A server whose directory can't list everyone (an LDAP size limit) filters on the names typed instead.
  const listsFailed = Boolean(users.error || groups.error);
  const searchedUsers = useMemberNames(server, 'user', { filter: typed, enabled: Boolean(users.error) && typed.length > 0 });
  const searchedGroups = useMemberNames(server, 'group', { filter: typed, enabled: Boolean(groups.error) && typed.length > 0 });

  const loading = (users.isLoading && !users.error) || (groups.isLoading && !groups.error);
  const candidates = memberCandidates({
    users: users.data ?? searchedUsers.data ?? [],
    groups: groups.data ?? searchedGroups.data ?? [],
    specials,
    listed,
    search,
  });
  const activeIndex = Math.min(active, Math.max(0, candidates.length - 1));

  const pick = (candidate: MemberCandidate | undefined): void => {
    if (candidate && !candidate.listed) finish(candidate.member);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pick(candidates[activeIndex]);
      return;
    }
    const next = navigationTarget(event.key, activeIndex, candidates.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' });
  };

  return (
    <Dialog title={title} description={description} width={480} onClose={() => finish(undefined)}>
      <SearchField
        value={search}
        onChange={(value) => {
          setSearch(value);
          setActive(0);
        }}
        placeholder="Find a user or group"
        autoFocus
        width="100%"
        aria-controls={listId}
        aria-activedescendant={candidates.length > 0 ? `${listId}-${activeIndex}` : undefined}
        onKeyDown={onKeyDown}
      />
      {listsFailed && <p className={styles.note}>The server can’t list everyone: type a name to look it up.</p>}
      {loading ? (
        <CenteredSpinner />
      ) : (
        <HighlightQuery query={search}>
          <div id={listId} className={styles.list} role="listbox" aria-label="Users and groups">
            {candidates.map((candidate, index) => (
              <div
                key={`${candidate.role}:${candidate.member.name}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                aria-disabled={candidate.listed}
                className={styles.option}
                data-active={index === activeIndex}
                onMouseMove={() => setActive(index)}
                onClick={() => pick(candidate)}
              >
                <MemberIcon name={candidate.member.name} role={candidate.role} />
                <span className={styles.name}>
                  <Highlight text={candidate.label} />
                </span>
                {candidate.listed && <span className={styles.listed}>Already listed</span>}
              </div>
            ))}
            {candidates.length === 0 && <div className={styles.empty}>{listsFailed && !typed ? 'Type a name.' : 'No users or groups found.'}</div>}
          </div>
        </HighlightQuery>
      )}
    </Dialog>
  );
}
