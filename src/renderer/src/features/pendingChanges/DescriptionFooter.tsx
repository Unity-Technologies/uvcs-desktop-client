import { GitPullRequestArrow, History } from 'lucide-react';
import { Fragment } from 'react';
import { recentCommentPick } from '../../lib/comment';
import { Tooltip } from '../../ui/Tooltip';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { descriptionFooterButtons } from './descriptionFooterButtons';
import styles from './CheckinPanel.module.css';

interface DescriptionFooterProps {
  recentComments: readonly string[];
  /** How many change requests the check-in offers to apply. */
  changeRequests: number;
  /** A recent comment picked: its parts go in the summary and the description. */
  onRecentComment: (pick: ReturnType<typeof recentCommentPick>) => void;
  /** Where the caret goes once the recent comments' menu closes, after a pick. */
  onRecentMenuClosed: (event: Event) => void;
  /** Opens the change requests' list in the description, at its caret. */
  onChangeRequests: () => void;
}

/**
 * The check-in description's footer (`descriptionFooterButtons`): quiet icon buttons at its bottom-left, apart by
 * hairlines; nothing at all when it has none.
 */
export function DescriptionFooter({ recentComments, changeRequests, onRecentComment, onRecentMenuClosed, onChangeRequests }: DescriptionFooterProps) {
  const buttons = descriptionFooterButtons({ recentComments: recentComments.length, changeRequests });
  if (buttons.length === 0) return null;
  return (
    <div className={styles.descriptionFooter} role="toolbar" aria-label="Description">
      {buttons.map((button, index) => (
        <Fragment key={button.kind}>
          {index > 0 && <span className={styles.footerSeparator} aria-hidden />}
          {button.kind === 'recentComments' ? (
            <ActionDropdownMenu
              entries={recentComments.map((recent, entry) => ({ id: `recent.${entry}`, label: recent.split('\n')[0]!, run: () => onRecentComment(recentCommentPick(recent)) }))}
              onCloseAutoFocus={onRecentMenuClosed}
            >
              <Tooltip content={button.tip}>
                <button type="button" className={styles.footerButton} aria-label={button.tip}>
                  <History size={15} aria-hidden />
                </button>
              </Tooltip>
            </ActionDropdownMenu>
          ) : (
            <Tooltip content={button.tip}>
              <button
                type="button"
                className={styles.footerButton}
                aria-label={button.label}
                // A press leaves the caret where it is in the description: the list opens there. The keyboard's Enter opens it at the end.
                onMouseDown={(event) => event.preventDefault()}
                onClick={onChangeRequests}
              >
                <GitPullRequestArrow size={15} aria-hidden />
                <span className={styles.footerCount}>{button.count}</span>
              </button>
            </Tooltip>
          )}
        </Fragment>
      ))}
    </div>
  );
}
