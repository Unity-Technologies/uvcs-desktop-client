import { Eye, EyeOff, GitBranch, Pencil, RotateCcw, UserMinus, UserPlus, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../../app/workspace/useWorkspace';
import { commentDraftKey } from '../../../components/DetailsHeading';
import { FoldedComment } from '../../../components/FoldedComment';
import { ReferenceChip } from '../../../components/comments/ReferenceChip';
import { classNames } from '../../../lib/classNames';
import { displayName } from '../../../lib/userName';
import { Avatar } from '../../../ui/Avatar';
import { RelativeTime } from '../../../ui/RelativeTime';
import { MERGE_REQUEST_STATE_ICONS } from '../mergeRequestState';
import { REVIEW_STATUS_ICONS } from '../reviewStatusIcons';
import { CommentComposer } from './CommentComposer';
import { CommentMenuButton } from './CommentMenuButton';
import { editStatusComment } from './reviewCommentOperations';
import { reviewEventRow, type ReviewEventContext, type ReviewEventIcon } from './reviewEventText';
import type { ShownEvent } from './reviewThreads';
import { statusCommentMenu } from './statusCommentMenu';
import stateColors from '../mergeRequestStateColors.module.css';
import styles from './ReviewConversation.module.css';

/** How many lines of what a reviewer said with their status show before "Show more". */
const STATUS_COMMENT_LINES = 4;

const ICONS: Record<ReviewEventIcon, LucideIcon> = {
  reviewRequested: UserPlus,
  reviewRequestedAgain: RotateCcw,
  reviewerRemoved: UserMinus,
  renamed: Pencil,
  destinationChanged: GitBranch,
  branchHidden: EyeOff,
  branchUnhidden: Eye,
  ...REVIEW_STATUS_ICONS,
  ...MERGE_REQUEST_STATE_ICONS,
};

/**
 * A quiet line for what the server noted: who did what, when; a status change with the changeset it was given at and
 * what its reviewer said under it, a merge with its changeset, each changeset named as words of the sentence. Its
 * reviewer edits what they said with a status in place (`statusCommentMenu`).
 */
export function TimelineEventRow({ event, context, user }: { event: ShownEvent; context?: ReviewEventContext; user?: string }) {
  const place = usePlace();
  const [editing, setEditing] = useState(false);
  const row = reviewEventRow(event, context);
  const Icon = ICONS[row.icon];
  const menu = statusCommentMenu(event, user, { edit: () => setEditing(true) });
  return (
    <div className={styles.event} data-icon={row.icon}>
      <span className={classNames(styles.eventIcon, row.state && stateColors.stateColor)} data-state={row.state}>
        <Icon size={14} aria-hidden />
      </span>
      <div className={styles.eventBody}>
        <p className={styles.eventLine}>
          <Avatar user={event.author} size={18} />
          <span className={styles.author}>{displayName(event.author)}</span> {row.text}
          {row.changeset !== undefined && (
            // One piece when the line wraps: the changeset and the dot that parts its number from the time's
            // ("at 10 · 5 minutes ago", never "at 10 5 minutes ago").
            <span className={styles.eventChangeset}>
              <ReferenceChip reference={{ kind: 'changeset', id: row.changeset }} source={`cs:${row.changeset}`} plain />
              <span className={styles.eventSeparator} aria-hidden>
                ·
              </span>
            </span>
          )}{' '}
          <RelativeTime date={event.date} />
          {menu.length > 0 && <CommentMenuButton entries={menu} />}
        </p>
        {editing && event.kind === 'statusChanged' ? (
          <div className={styles.eventEditor}>
            <CommentComposer
              draftKey={commentDraftKey(placeId(place), 'reviewCommentEdit', event.guid)}
              initialText={event.comment}
              placeholder="Comment (optional)"
              label="Edit comment"
              submitLabel="Save"
              allowEmpty
              autoFocus
              onSubmit={async (text) => {
                const saved = await editStatusComment(place, event, text);
                if (saved) setEditing(false);
                return saved;
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          row.comment && (
            // Folded past a few lines, "Show more" opening it: a status can come with a wall of text.
            <div className={`${styles.eventComment} ${styles.markdown}`}>
              <FoldedComment titleClassName="" description={row.comment} titleLines={1} descriptionLines={STATUS_COMMENT_LINES} />
            </div>
          )
        )}
      </div>
    </div>
  );
}
