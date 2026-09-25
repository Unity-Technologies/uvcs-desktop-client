import { Copy, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { IconButton } from '../../ui/IconButton';
import { useCommandLogStore } from './commandLogStore';
import styles from './CommandLogPanel.module.css';

export function CommandLogPanel() {
  const { entries, clear, toggle } = useCommandLogStore();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [entries.length]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>Command log</span>
        <span className={styles.count}>{entries.length} commands</span>
        <div className={styles.spacer} />
        <IconButton size="small" icon={<Trash2 size={13} />} label="Clear" onClick={clear} />
        <IconButton size="small" icon={<X size={14} />} label="Close" onClick={toggle} />
      </header>
      <div ref={listRef} className={`${styles.list} selectable`}>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.entry} data-failed={entry.exitCode !== 0}>
            <span className={styles.duration}>{entry.durationMs} ms</span>
            <span className={styles.command}>{entry.commandLine}</span>
            <button className={styles.copy} onClick={() => void navigator.clipboard.writeText(entry.commandLine)} data-tip="Copy command">
              <Copy size={11} />
            </button>
            {entry.output && <pre className={styles.output}>{entry.output}</pre>}
          </div>
        ))}
      </div>
    </section>
  );
}
