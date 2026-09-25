import { Check, Copy, TerminalSquare } from 'lucide-react';
import { useState } from 'react';
import styles from './CopyableCommand.module.css';

const COPIED_FEEDBACK_MS = 1500;

/** A terminal command to run, with a note above it and a copy button. */
export function CopyableCommand({ note, command }: { note: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = (): void => {
    void navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <div className={styles.block}>
      <span className={styles.note}>{note}</span>
      <div className={styles.row}>
        <TerminalSquare size={14} className={styles.icon} />
        <code className={`${styles.command} selectable`}>{command}</code>
        <button className={styles.copy} onClick={copy} aria-label="Copy command" data-tip={copied ? 'Copied' : 'Copy command'}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>
    </div>
  );
}
