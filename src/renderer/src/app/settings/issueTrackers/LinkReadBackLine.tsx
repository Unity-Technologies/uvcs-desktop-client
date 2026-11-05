import type { LinkParts } from './connectFlow';
import { CheckedLine } from './CheckedLine';
import styles from './IssueTrackerPane.module.css';

/** A link read back (`linkReadBack`'s parts): checked, the tracker's kind as a badge, then the host and the project. */
export function LinkReadBackLine({ parts, words }: { parts: LinkParts; words: string }) {
  return (
    <div aria-label={words} role="status">
      <CheckedLine>
        <span className={styles.badge}>{parts.kindName}</span> {parts.host} · {parts.projectNoun && `${parts.projectNoun} `}
        <strong>{parts.project}</strong>
      </CheckedLine>
    </div>
  );
}
