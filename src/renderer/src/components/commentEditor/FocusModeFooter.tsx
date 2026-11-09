import { KeyHints } from '../../ui/KeyHints';
import { useIssueReferences } from '../issues/useIssueTrackers';
import { focusModeHints } from './focusModeHints';

/**
 * The comment editor's hints, a caption under the comment on one line: what the triggers write (`focusModeHints`),
 * `#` where the place has a tracker.
 */
export function FocusModeFooter() {
  const issues = useIssueReferences() !== undefined;
  return <KeyHints caption oneLine hints={focusModeHints({ issues })} />;
}
