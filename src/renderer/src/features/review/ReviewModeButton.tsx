import { ListChecks } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { setReviewMode, useReviewModeOn } from './reviewModeSetting';
import styles from './ReviewModeButton.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

/** Turns review mode on or off for the workspace; lit while it's on. At the end of the filter bar of the lists that review (`useChangeFilter`'s `actions`), right above the review bar it opens. */
export function ReviewModeButton({ workspacePath }: { workspacePath: string }) {
  const on = useReviewModeOn(workspacePath);
  return (
    <IconButton
      icon={<ListChecks size={14} />}
      label={on ? 'Leave review mode' : 'Review mode: mark files as you review them'}
      shortcut={on ? undefined : hotkey('review')}
      className={styles.button}
      aria-pressed={on}
      onClick={() => void setReviewMode(workspacePath, !on)}
    />
  );
}
