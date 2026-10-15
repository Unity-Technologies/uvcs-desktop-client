import { useMemo, useState } from 'react';
import type { MemberRef } from '@shared/domain/permissions';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { Highlight } from '../../ui/Highlight';
import { PickList } from '../../ui/PickList';
import { matchingCandidates, memberCandidates, type MemberCandidate } from './memberCandidates';
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

// Constants rather than fresh defaults, so the candidates built from them stay memoized across renders.
const NONE_LISTED: ReadonlySet<string> = new Set();
const NO_NAMES: readonly string[] = [];

function MemberPickerDialog({ server, title, description, listed = NONE_LISTED, specials = false, finish }: PickMemberOptions & { finish: (member: MemberRef | undefined) => void }) {
  const [search, setSearch] = useState('');
  const typed = useDebouncedValue(search.trim(), SEARCH_PAUSE_MS);
  const users = useMemberNames(server, 'user');
  const groups = useMemberNames(server, 'group');
  // A server whose directory can't list everyone (an LDAP size limit) filters on the names typed instead.
  const listsFailed = Boolean(users.error || groups.error);
  const searchedUsers = useMemberNames(server, 'user', { filter: typed, enabled: Boolean(users.error) && typed.length > 0 });
  const searchedGroups = useMemberNames(server, 'group', { filter: typed, enabled: Boolean(groups.error) && typed.length > 0 });

  const loading = (users.isLoading && !users.error) || (groups.isLoading && !groups.error);
  const userNames = users.data ?? searchedUsers.data ?? NO_NAMES;
  const groupNames = groups.data ?? searchedGroups.data ?? NO_NAMES;
  const everyone = useMemo(() => memberCandidates({ users: userNames, groups: groupNames, specials, listed }), [userNames, groupNames, specials, listed]);
  const candidates = useMemo(() => matchingCandidates(everyone, search), [everyone, search]);

  return (
    <Dialog title={title} description={description} width={480} onClose={() => finish(undefined)}>
      <PickList<MemberCandidate>
        items={candidates}
        itemKey={(candidate) => `${candidate.role}:${candidate.member.name}`}
        search={search}
        onSearchChange={setSearch}
        placeholder="Find a user or group"
        label="Users and groups"
        onPick={(candidate) => finish(candidate.member)}
        isDisabled={(candidate) => candidate.listed}
        note={listsFailed && <p className={styles.note}>The server can’t list everyone: type a name to look it up.</p>}
        loading={loading}
        rowHeight={34}
        height={320}
        empty={listsFailed && !typed ? 'Type a name.' : 'No users or groups found.'}
        renderItem={(candidate) => (
          <>
            <MemberIcon name={candidate.member.name} role={candidate.role} />
            <span className={styles.name}>
              <Highlight text={candidate.label} />
            </span>
            {candidate.listed && <span className={styles.listed}>Already listed</span>}
          </>
        )}
      />
    </Dialog>
  );
}
