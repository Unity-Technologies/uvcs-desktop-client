import * as Popover from '@radix-ui/react-popover';
import { FileDiff, GalleryHorizontalEnd, History } from 'lucide-react';
import { useMemo, useRef, type RefObject } from 'react';
import type { AnnotationChangeset } from '@shared/domain/annotate';
import type { ItemRevision } from '@shared/domain/history';
import { formatDateTime } from '../../lib/formatDate';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { RelativeTime } from '../../ui/RelativeTime';
import styles from './AnnotationCard.module.css';

/** What can be done from a block's card. */
export interface BlockCardActions {
  openChangeset: (changesetId: number) => void;
  /** The revision before the change, when the history has one. */
  revisionBefore?: ItemRevision;
  annotateBefore: (revision: ItemRevision) => void;
  showInHistory: (changesetId: number) => void;
}

interface AnnotationCardProps {
  changeset: AnnotationChangeset | undefined;
  /** The label the card opens beside. */
  anchor: () => Element | null;
  open: boolean;
  /** Opened by a click or a key: it takes the focus, for the keyboard. */
  pinned: boolean;
  onOpenChange: (open: boolean) => void;
  /** Keep it open while the pointer is on it. */
  hoverProps: { onMouseEnter: () => void; onMouseLeave: () => void };
  actions: BlockCardActions;
  /** Where the focus goes back to from a card that took it: it has no trigger of its own. */
  returnFocusTo: HTMLElement | null;
}

/** The changeset behind a block of lines: its whole comment, who and when, and where to go from it. */
export function AnnotationCard({ changeset, anchor, open, pinned, onOpenChange, hoverProps, actions, returnFocusTo }: AnnotationCardProps) {
  const anchorRef = useMemo<RefObject<{ getBoundingClientRect: () => DOMRect }>>(
    () => ({ current: { getBoundingClientRect: () => anchor()?.getBoundingClientRect() ?? new DOMRect() } }),
    [anchor],
  );
  // Only a card opened by a click or a key takes focus, so only that one gives it back.
  const tookFocus = useRef(false);

  return (
    <Popover.Root open={open && changeset !== undefined} onOpenChange={onOpenChange}>
      <Popover.Anchor virtualRef={anchorRef} />
      <Popover.Portal>
        {changeset && (
          <Popover.Content
            className={styles.card}
            side="right"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            {...hoverProps}
            onOpenAutoFocus={(event) => {
              tookFocus.current = pinned;
              if (!pinned) event.preventDefault();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (tookFocus.current) returnFocusTo?.focus({ preventScroll: true });
            }}
          >
            <div className={styles.head}>
              <Avatar user={changeset.owner} size={28} tip={null} />
              <div className={styles.who}>
                <span className={styles.author}>{displayName(changeset.owner)}</span>
                <span className={styles.when} data-tip={formatDateTime(changeset.date)}>
                  <RelativeTime date={changeset.date} />
                </span>
              </div>
              <span className={styles.changeset}>cs:{changeset.changesetId}</span>
            </div>
            <p className={`${styles.comment} selectable`}>{changeset.comment.trim() || <span className={styles.noComment}>No comment</span>}</p>
            <div className={styles.branch}>
              {changeset.branch}
              {changeset.isMerge && <span className={styles.merge}> · by a merge</span>}
            </div>
            <div className={styles.actions}>
              <Button size="small" icon={<FileDiff size={13} />} onClick={() => actions.openChangeset(changeset.changesetId)}>
                Open changeset
              </Button>
              {actions.revisionBefore && (
                <Button
                  size="small"
                  icon={<GalleryHorizontalEnd size={13} />}
                  data-tip={`The file as of cs:${actions.revisionBefore.changesetId}`}
                  onClick={() => actions.annotateBefore(actions.revisionBefore!)}
                >
                  Annotate before
                </Button>
              )}
              <Button size="small" variant="ghost" icon={<History size={13} />} onClick={() => actions.showInHistory(changeset.changesetId)}>
                Show in history
              </Button>
            </div>
          </Popover.Content>
        )}
      </Popover.Portal>
    </Popover.Root>
  );
}
