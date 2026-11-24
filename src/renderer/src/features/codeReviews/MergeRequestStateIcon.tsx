import type { MergeRequestInfo } from '@shared/domain/codeReview';
import { MERGE_REQUEST_STATE_ICONS, mergeRequestTip } from './mergeRequestState';
import styles from './MergeRequestStateIcon.module.css';

interface MergeRequestStateIconProps {
  mergeRequest: MergeRequestInfo;
  size?: number;
  /** Whether it shows its tooltip ("Open merge request into /main"); off where the state is written beside it. */
  tip?: boolean;
}

/** A merge request's state as its glyph in its color, named for a screen reader and in its tooltip. */
export function MergeRequestStateIcon({ mergeRequest, size = 14, tip = true }: MergeRequestStateIconProps) {
  const Icon = MERGE_REQUEST_STATE_ICONS[mergeRequest.state];
  const label = mergeRequestTip({ mergeRequest });
  return (
    <span className={styles.icon} data-state={mergeRequest.state} role="img" aria-label={label} data-tip={tip ? label : undefined}>
      <Icon size={size} aria-hidden />
    </span>
  );
}
