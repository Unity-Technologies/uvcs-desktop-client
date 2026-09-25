import { Archive, ChevronDown, History, Undo2 } from 'lucide-react';
import type { MenuEntry } from '../../lib/actions';
import { SEPARATOR } from '../../lib/actions';
import { useShortcut } from '../../lib/useShortcut';
import { Button } from '../../ui/Button';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import styles from './CheckinPanel.module.css';

interface CheckinPanelProps {
  comment: string;
  onCommentChange: (comment: string) => void;
  includedCount: number;
  branchName: string;
  recentComments: string[];
  busy: boolean;
  onCheckin: () => void;
  onShelve: () => void;
  onUndoUnchanged: () => void;
}

export function CheckinPanel({
  comment,
  onCommentChange,
  includedCount,
  branchName,
  recentComments,
  busy,
  onCheckin,
  onShelve,
  onUndoUnchanged,
}: CheckinPanelProps) {
  const canCheckin = includedCount > 0 && !busy;
  useShortcut('mod+enter', onCheckin, canCheckin);

  const moreActions: MenuEntry[] = [
    { id: 'shelve', label: 'Shelve selected changes', icon: Archive, disabled: includedCount === 0, run: onShelve },
    { id: 'undoUnchanged', label: 'Undo unchanged checkouts', icon: Undo2, run: onUndoUnchanged },
    ...(recentComments.length > 0
      ? [
          SEPARATOR,
          {
            label: 'Recent comments',
            icon: History,
            entries: recentComments.map((recent, index) => ({
              id: `recent.${index}`,
              label: recent.split('\n')[0]!,
              run: () => onCommentChange(recent),
            })),
          },
        ]
      : []),
  ];

  return (
    <div className={styles.panel}>
      <textarea
        className={styles.comment}
        placeholder="Describe your changes…"
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        spellCheck
      />
      <div className={styles.actions}>
        <Button variant="primary" className={styles.checkin} disabled={!canCheckin} loading={busy} onClick={onCheckin}>
          {includedCount === 0 ? 'Nothing to check in' : `Check in ${includedCount} ${includedCount === 1 ? 'change' : 'changes'}`}
          <span className={styles.branch}>to {branchName}</span>
        </Button>
        <ActionDropdownMenu entries={moreActions}>
          <Button icon={<ChevronDown size={14} />} aria-label="More checkin options" />
        </ActionDropdownMenu>
      </div>
    </div>
  );
}
