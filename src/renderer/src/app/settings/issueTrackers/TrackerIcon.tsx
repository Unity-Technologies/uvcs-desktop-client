import type { IssueTrackerKind } from '@shared/domain/issueTrackers';
import { choiceOf } from './trackerChoices';
import { TrackerLogo } from './TrackerLogo';

/** A connection's tracker as its logo (`TrackerLogo`): Jira's for Cloud and Data Center alike, GitHub's. */
export function TrackerIcon({ kind, size = 30 }: { kind: IssueTrackerKind; size?: number }) {
  return <TrackerLogo choice={choiceOf(kind)} size={size} />;
}
