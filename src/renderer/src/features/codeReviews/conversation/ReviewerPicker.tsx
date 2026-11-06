import { useMemo, useState } from 'react';
import { usePlaceServer } from '../../../app/workspace/useWorkspace';
import { matchesWordFilter } from '../../../lib/matchesAllWords';
import { displayName, userFilterTexts } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { FilterChecklist } from '../../../ui/FilterChecklist';
import { Highlight } from '../../../ui/Highlight';
import { useMemberNames } from '../../permissions/permissionsQueries';
import { offeredReviewers } from '../reviewers';
import type { CodeReview } from '@shared/domain/codeReview';
import styles from './ReviewConversation.module.css';

interface ReviewerPickerProps {
  review: CodeReview;
  /** Who is checked: the reviewers as the picker opened, changed by each click; applied once it closes. */
  picked: readonly string[];
  onPickedChange: (picked: string[]) => void;
}

/**
 * The reviewers' popover: a field to find anyone on the server (`cm listusers`, read once and kept), the reviewers
 * checked at the top. Checking asks someone, unchecking takes them off; it all applies as the popover closes.
 */
export function ReviewerPicker({ review, picked, onPickedChange }: ReviewerPickerProps) {
  const server = usePlaceServer();
  const [search, setSearch] = useState('');
  const { data: users = [], isPending } = useMemberNames(server ?? '', 'user', { enabled: server !== undefined });
  // The reviewers as the popover opened lead the list: checking and unchecking never moves a row.
  const [reviewersOnOpen] = useState(review.reviewers);
  const offered = useMemo(() => offeredReviewers(users, reviewersOnOpen), [users, reviewersOnOpen]);
  const rows = useMemo(() => offered.filter((user) => matchesWordFilter(userFilterTexts(user), search)), [offered, search]);
  const isPicked = (user: string): boolean => picked.some((name) => name.toLowerCase() === user.toLowerCase());

  return (
    <FilterChecklist
      rows={rows}
      search={search}
      onSearchChange={setSearch}
      placeholder="Find a user"
      label="Reviewers"
      isChecked={isPicked}
      onToggle={(user) => onPickedChange(isPicked(user) ? picked.filter((name) => name.toLowerCase() !== user.toLowerCase()) : [...picked, user])}
      renderRow={(user) => (
        <>
          <Avatar user={user} size={18} tip={null} />
          <span className={styles.pickerName}>
            <Highlight text={displayName(user)} />
          </span>
          {displayName(user).toLowerCase() !== user.toLowerCase() && (
            <span className={styles.pickerStored}>
              <Highlight text={user} />
            </span>
          )}
        </>
      )}
      empty={isPending ? 'Reading the users…' : <>No one matches “{search.trim()}”</>}
    />
  );
}
