import type { ProofLine } from './trackerCardContent';
import type { LinkParts } from './connectFlow';
import { CheckedLine } from './CheckedLine';
import styles from './IssueTrackerPane.module.css';

/** The proof a sign-in works (`proofLines`): each line checked, its value bold. */
export function ProofLines({ lines }: { lines: readonly ProofLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <CheckedLine key={line.lead}>
          {line.lead} <strong>{line.strong}</strong>
          {line.after}
        </CheckedLine>
      ))}
    </>
  );
}

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
