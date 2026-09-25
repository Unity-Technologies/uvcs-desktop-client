import type { IncomingChanges } from '@shared/domain/incoming';
import { fileNameOf, firstLine, pluralize } from '../../lib/text';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import styles from './CheckinRejectedDialog.module.css';

const SHOWN_CHANGESETS = 4;

/** Update right away and check in again, or look at what came in first (it touches the same files, or needs merging). */
export type CatchUpChoice = 'updateAndCheckin' | 'review';

interface CheckinRejectedRequest {
  incoming: IncomingChanges;
  /** The paths being checked in that the incoming changesets touch too. */
  overlapping: string[];
  /** Updating needs a decision first: files changed on both sides, or files the branch deleted or moved. */
  needsReview: boolean;
}

/** Explains that the branch moved on and offers the way forward. Resolves with the choice, or undefined if cancelled. */
export function askCatchUpForCheckin(request: CheckinRejectedRequest): Promise<CatchUpChoice | undefined> {
  return askDialog<CatchUpChoice>((finish) => <CheckinRejectedDialog {...request} onFinish={finish} />);
}

function CheckinRejectedDialog({ incoming, overlapping, needsReview, onFinish }: CheckinRejectedRequest & { onFinish: (choice: CatchUpChoice | undefined) => void }) {
  const primary: CatchUpChoice = needsReview ? 'review' : 'updateAndCheckin';
  const shown = incoming.changesets.slice(0, SHOWN_CHANGESETS);
  const more = incoming.changesets.length - shown.length;

  return (
    <Dialog
      title={`Someone checked in on ${incoming.branch}`}
      width={480}
      onClose={() => onFinish(undefined)}
      onSubmit={() => onFinish(primary)}
      footer={
        <>
          <Button onClick={() => onFinish(undefined)}>Cancel</Button>
          <Button type="submit" variant="primary" autoFocus>
            {primary === 'review' ? 'Review incoming' : 'Update and check in'}
          </Button>
        </>
      }
    >
      <p className={styles.message}>
        Your workspace is at changeset {incoming.loadedChangeset}; the branch is now at {incoming.headChangeset}. Update first, then check in again.
        Your comment is kept.
      </p>
      <ul className={styles.changesets}>
        {shown.map((changeset) => (
          <li key={changeset.id} className={styles.changeset}>
            <Avatar user={changeset.owner} size={18} />
            <span className={styles.comment}>{firstLine(changeset.comment) || 'No comment'}</span>
            <span className={styles.meta}>
              {displayName(changeset.owner)} · cs:{changeset.id}
            </span>
          </li>
        ))}
        {more > 0 && <li className={styles.more}>and {more} more</li>}
      </ul>
      {needsReview && <p className={styles.review}>{reviewReason(incoming, overlapping)}</p>}
    </Dialog>
  );
}

function reviewReason(incoming: IncomingChanges, overlapping: string[]): string {
  if (overlapping.length === 0) return 'Some of your other changes collide with what came in. Review it before updating.';
  const names = overlapping.slice(0, 2).map(fileNameOf).join(', ');
  const rest = overlapping.length > 2 ? ` and ${overlapping.length - 2} more` : '';
  const them = incoming.changesets.length === 1 ? 'It' : 'They';
  return `${them} also changed ${pluralize(overlapping.length, 'file')} you're checking in (${names}${rest}). Review what came in before updating.`;
}
