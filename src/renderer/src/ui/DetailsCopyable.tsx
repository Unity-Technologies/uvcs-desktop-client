import { Copy } from 'lucide-react';
import { copyToClipboard } from '../lib/copyToClipboard';
import styles from './DetailsCopyable.module.css';

/** An identifier in the meta row (`cs:42`, a GUID's start) that copies the full value. */
export function DetailsCopyable({ text, copyText = text, what }: { text: string; copyText?: string; what: string }) {
  return (
    <button className={styles.copyable} onClick={() => copyToClipboard(copyText, what)} data-tip={`Copy ${what.toLowerCase()}: ${copyText}`}>
      <span className="mono">{text}</span>
      <Copy size={11} className={styles.copyIcon} />
    </button>
  );
}
