import type { CommandLogEntry } from '@shared/events';
import { Copy } from 'lucide-react';
import { memo } from 'react';
import { withControlPictures } from '../../lib/controlPictures';
import styles from './CommandLogPanel.module.css';

interface CommandLogEntryRowProps {
  entry: CommandLogEntry;
  revealed: boolean;
  /** Where it ran, for commands of other workspaces or none. */
  cwd?: string;
}

/** One command, its duration and, when it failed, its output. Memoized: a new command renders only its own row. */
export const CommandLogEntryRow = memo(function CommandLogEntryRow({ entry, revealed, cwd }: CommandLogEntryRowProps) {
  return (
    <div className={styles.entry} data-entry-id={entry.id} data-failed={entry.exitCode !== 0} data-revealed={revealed}>
      <span className={styles.duration}>{entry.durationMs} ms</span>
      <span className={styles.command}>
        {withControlPictures(entry.commandLine)}
        {cwd && <span className={styles.cwd}>in {cwd}</span>}
      </span>
      <button className={styles.copy} onClick={() => void navigator.clipboard.writeText(entry.commandLine)} data-tip="Copy command" aria-label="Copy command">
        <Copy size={11} />
      </button>
      {entry.output && <pre className={styles.output}>{withControlPictures(entry.output)}</pre>}
    </div>
  );
});
