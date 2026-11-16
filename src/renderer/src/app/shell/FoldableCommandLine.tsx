import { useState } from 'react';
import { withControlPictures } from '../../lib/controlPictures';
import { CommandLineText } from './CommandLineText';
import { foldedCommandLine } from './foldedCommandLine';
import styles from './CommandLogPanel.module.css';

/**
 * A logged command line, its long run of ORed conditions folded (`foldedCommandLine`) behind a small "…48 more…"
 * button that shows it whole, and folds it back. Lines without one show whole.
 */
export function FoldableCommandLine({ line }: { line: string }) {
  const [expanded, setExpanded] = useState(false);
  const folded = foldedCommandLine(line);
  if (!folded) return <CommandLineText line={withControlPictures(line)} />;
  if (expanded) {
    return (
      <>
        <CommandLineText line={withControlPictures(line)} />
        <button type="button" className={styles.fold} onClick={() => setExpanded(false)} aria-expanded data-tip="Show fewer">
          Show fewer
        </button>
      </>
    );
  }
  return (
    <>
      <CommandLineText line={withControlPictures(folded.head)} />
      <button type="button" className={styles.fold} onClick={() => setExpanded(true)} aria-expanded={false} data-tip={`Show all ${folded.hidden + 2}`}>
        …{folded.hidden} more…
      </button>
      <CommandLineText line={withControlPictures(folded.tail)} />
    </>
  );
}
