import { GitPullRequestArrow, History } from 'lucide-react';
import { forwardRef, Fragment, type ButtonHTMLAttributes } from 'react';
import { recentCommentPick } from '../../lib/comment';
import { Tooltip } from '../../ui/Tooltip';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import type { DescriptionFooterButton } from './descriptionFooterButtons';
import styles from './CheckinPanel.module.css';

interface DescriptionFooterProps {
  /** What it shows (`descriptionFooterButtons`). */
  buttons: readonly DescriptionFooterButton[];
  recentComments: readonly string[];
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
export function DescriptionFooter({ buttons, recentComments, onRecentComment, onRecentMenuClosed, onChangeRequests }: DescriptionFooterProps) {
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
              <FooterButton tip={button.tip} aria-label={button.tip}>
                <History size={13} aria-hidden />
              </FooterButton>
            </ActionDropdownMenu>
          ) : (
            <FooterButton
              tip={button.tip}
              aria-label={button.label}
              // A press leaves the caret where it is in the description: the list opens there. The keyboard's Enter opens it at the end.
              onMouseDown={(event) => event.preventDefault()}
              onClick={onChangeRequests}
            >
              <GitPullRequestArrow size={13} aria-hidden />
              <span className={styles.footerCount}>{button.count}</span>
            </FooterButton>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * One of the footer's quiet buttons, its tooltip naming it. Like `IconButton`, it takes the props and the ref of a menu
 * trigger it is the child of (`ActionDropdownMenu`'s `asChild`) onto its button: given to the tooltip, they never
 * reached it, and Recent comments opened nothing.
 */
const FooterButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { tip: string }>(function FooterButton({ tip, ...rest }, ref) {
  return (
    <Tooltip content={tip}>
      <button ref={ref} type="button" className={styles.footerButton} {...rest} />
    </Tooltip>
  );
});
