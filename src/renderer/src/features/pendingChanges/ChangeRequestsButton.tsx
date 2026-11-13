import { GitPullRequestArrow } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';
import type { BranchChangeRequests } from '../codeReviews/changeRequests/useChangeRequests';
import { changeRequestsButton } from './changeRequestsButtonState';

interface ChangeRequestsButtonProps {
  changeRequests: BranchChangeRequests;
  className?: string;
  /** Opens their list in the description, at its caret. */
  onOpen: () => void;
}

/** The change requests the check-in can apply, with their count (`changeRequestsButton`); none while there are none. */
export function ChangeRequestsButton({ changeRequests, className, onOpen }: ChangeRequestsButtonProps) {
  const button = changeRequestsButton(changeRequests);
  if (!button) return null;
  return (
    <Tooltip content={button.tip}>
      <Button
        variant="ghost"
        size="small"
        className={className}
        icon={<GitPullRequestArrow size={14} />}
        aria-label={button.label}
        // The press leaves the caret where it is in the description: the list opens there.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onOpen}
      >
        {button.count}
      </Button>
    </Tooltip>
  );
}
