import type { CommandLogEntry } from '@shared/events';
import { Copy } from 'lucide-react';
import { memo } from 'react';
import { withControlPictures } from '../../lib/controlPictures';
import { Highlight } from '../../ui/Highlight';
import { commandEnding } from './commandEnding';
import styles from './CommandLogPanel.module.css';

interface CommandLogEntryRowProps {
  entry: CommandLogEntry;
  /** Its place in the log, which filtering doesn't change (`NumberedLog`). */
  number: number;
  revealed: boolean;
  /** Where it ran, for commands of other workspaces or none. */
  cwd?: string;
}

/**
 * One command, its number, its duration and, when it failed, how it ended (`commandEnding`) and its output, the filter's
 * words marked in each (the texts of `commandLogFilterTexts`). Memoized: a new command renders only its own row.
 */
export const CommandLogEntryRow = memo(function CommandLogEntryRow({ entry, number, revealed, cwd }: CommandLogEntryRowProps) {
  const failed = entry.exitCode !== 0;
  return (
    <div className={styles.entry} data-entry-id={entry.id} data-failed={failed} data-revealed={revealed}>
      <span className={styles.number} aria-hidden>
        {number}
      </span>
      <span className={styles.duration}>{entry.durationMs} ms</span>
      <span className={styles.command}>
        <Highlight text={withControlPictures(entry.commandLine)} />
        {cwd && (
          <span className={styles.cwd}>
            in <Highlight text={cwd} />
          </span>
        )}
      </span>
      <button className={styles.copy} onClick={() => void navigator.clipboard.writeText(entry.commandLine)} data-tip="Copy command" aria-label="Copy command">
        <Copy size={11} />
      </button>
      {failed && (
        <pre className={styles.output}>
          <span className={styles.ending}>
            <Highlight text={commandEnding(entry.exitCode)} />
          </span>
          {entry.output && '\n'}
          <Highlight text={withControlPictures(entry.output)} />
        </pre>
      )}
    </div>
  );
});
