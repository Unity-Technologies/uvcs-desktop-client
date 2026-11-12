import { ChevronRight, GitCommitHorizontal } from 'lucide-react';
import { useState } from 'react';
import { CHIP_ICONS } from '../../../components/comments/chipIcons';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { RelativeTime } from '../../../ui/RelativeTime';
import type { CheckinsEntry } from './reviewRounds';
import { checkinCommentText, checkinsText, shownCheckins } from './roundText';
import conversation from '../conversation/ReviewConversation.module.css';
import styles from './ReviewRounds.module.css';

/**
 * Changesets checked in one after another, as the timeline shows them: who checked in how many, when, then each
 * changeset's number and its comment's first line, a link to its diff in the review's Changes. A click on its line
 * folds the changesets away and back; those of a closed round start folded (`CheckinsEntry.startsOpen`).
 */
const ChangesetIcon = CHIP_ICONS.changeset;

export function CheckinsRow({ entry, onOpenChangeset }: { entry: CheckinsEntry; onOpenChangeset: (changesetId: number) => void }) {
  const [open, setOpen] = useState(entry.startsOpen);
  const [showsAll, setShowsAll] = useState(false);
  const { shown, more } = shownCheckins(entry.changesets, showsAll);
  return (
    <div className={conversation.event}>
      <span className={conversation.eventIcon}>
        <GitCommitHorizontal size={14} aria-hidden />
      </span>
      <div className={conversation.eventBody}>
        <p className={conversation.eventLine}>
          <Avatar user={entry.owner} size={18} />
          <span className={conversation.author}>{displayName(entry.owner)}</span>
          <button type="button" className={styles.checkinsToggle} aria-expanded={open} onClick={() => setOpen(!open)}>
            {checkinsText(entry)}
            <ChevronRight size={13} className={styles.chevron} aria-hidden />
          </button>
          <RelativeTime date={entry.changesets.at(-1)!.date} />
        </p>
        {open && (
          <ul className={styles.checkins}>
            {shown.map((changeset) => (
              <li key={changeset.id}>
                <button type="button" className={styles.checkin} data-tip="Show in Changes" onClick={() => onOpenChangeset(changeset.id)}>
                  {/* Named as a comment's chip names a changeset (`ReferenceChip`), without its fill: the row is the link. */}
                  <span className={styles.checkinId}>
                    <ChangesetIcon size={13} strokeWidth={2.25} aria-hidden />
                    {changeset.id}
                  </span>
                  <span className={styles.checkinComment}>{checkinCommentText(changeset)}</span>
                </button>
              </li>
            ))}
            {more > 0 && (
              <li>
                <button type="button" className={styles.more} onClick={() => setShowsAll(true)}>
                  {more} more
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
