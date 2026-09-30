import { Check, Copy, TerminalSquare } from 'lucide-react';
import { useCopiedFeedback } from '../useCopiedFeedback';
import styles from './CopyableCommand.module.css';

/** A terminal command to run, with a note above it and a copy button. */
export function CopyableCommand({ note, command }: { note: string; command: string }) {
  const { copied, copy } = useCopiedFeedback();

  return (
    <div className={styles.block}>
      <span className={styles.note}>{note}</span>
      <div className={styles.row}>
        <TerminalSquare size={14} className={styles.icon} />
        <code className={`${styles.command} selectable`}>{command}</code>
        <button className={styles.copy} onClick={() => copy(command)} aria-label="Copy command" data-tip={copied ? 'Copied' : 'Copy command'}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}
