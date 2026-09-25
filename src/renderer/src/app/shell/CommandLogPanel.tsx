import { Copy, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { ranInWorkspace } from './commandLogScope';
import { useCommandLogStore, type CommandLogScope } from './commandLogStore';
import styles from './CommandLogPanel.module.css';

const SCOPES: { value: CommandLogScope; label: string; title: string }[] = [
  { value: 'workspace', label: 'This workspace', title: 'Commands that ran in this workspace' },
  { value: 'all', label: 'All', title: 'Every command the app ran, including lookups of other workspaces and servers' },
];

export function CommandLogPanel() {
  const { entries, revealedId, scope, setScope, clear, toggle } = useCommandLogStore();
  const workspacePath = useWorkspacePath();
  const listRef = useRef<HTMLDivElement>(null);
  const shown = scope === 'all' ? entries : entries.filter((entry) => ranInWorkspace(entry, workspacePath));

  useEffect(() => {
    const revealed = revealedId !== null && listRef.current?.querySelector(`[data-entry-id="${revealedId}"]`);
    if (revealed) revealed.scrollIntoView({ block: 'center' });
    else listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [shown.length, revealedId]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>Command log</span>
        <span className={styles.count}>{shown.length} commands</span>
        <div className={styles.spacer} />
        <SegmentedControl value={scope} segments={SCOPES} onChange={setScope} />
        <IconButton size="small" icon={<Trash2 size={13} />} label="Clear" onClick={clear} />
        <IconButton size="small" icon={<X size={14} />} label="Close" onClick={toggle} />
      </header>
      <div ref={listRef} className={`${styles.list} selectable`}>
        {shown.map((entry) => (
          <div
            key={entry.id}
            className={styles.entry}
            data-entry-id={entry.id}
            data-failed={entry.exitCode !== 0}
            data-revealed={entry.id === revealedId}
          >
            <span className={styles.duration}>{entry.durationMs} ms</span>
            <span className={styles.command}>
              {entry.commandLine}
              {scope === 'all' && !ranInWorkspace(entry, workspacePath) && <span className={styles.cwd}>in {entry.cwd}</span>}
            </span>
            <button className={styles.copy} onClick={() => void navigator.clipboard.writeText(entry.commandLine)} data-tip="Copy command" aria-label="Copy command">
              <Copy size={11} />
            </button>
            {entry.output && <pre className={styles.output}>{entry.output}</pre>}
          </div>
        ))}
      </div>
    </section>
  );
}
