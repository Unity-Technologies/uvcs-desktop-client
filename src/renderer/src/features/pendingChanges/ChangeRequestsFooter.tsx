import { GitPullRequestArrow } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';
import type { ReviewChangeRequest } from '../codeReviews/changeRequests/changeRequests';
import { changeRequestsButton } from './changeRequestsButtonState';
import styles from './CheckinPanel.module.css';

interface ChangeRequestsButtonProps {
  offered: readonly ReviewChangeRequest[];
  /** Opens their list in the description, at its caret. */
  onOpen: () => void;
}

/**
 * The description's footer while the check-in has change requests to offer (`changeRequestsButton`): their button,
 * icon and count; nothing at all otherwise.
 */
export function ChangeRequestsFooter({ offered, onOpen }: ChangeRequestsButtonProps) {
  const button = changeRequestsButton(offered);
  if (!button) return null;
  return (
    <div className={styles.descriptionFooter}>
      <Tooltip content={button.tip}>
        <Button
          variant="ghost"
          size="small"
          className={styles.changeRequests}
          icon={<GitPullRequestArrow size={14} />}
          aria-label={button.label}
          // The press leaves the caret where it is in the description: the list opens there.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onOpen}
        >
          {button.count}
        </Button>
      </Tooltip>
    </div>
  );
}
