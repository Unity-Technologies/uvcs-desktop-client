import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, Check, ChevronDown, GitCommitHorizontal, History } from 'lucide-react';
import { useState } from 'react';
import type { Icon } from '../../lib/actions';
import { useShortcut } from '../../lib/useShortcut';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import menuStyles from '../../ui/menu/Menu.module.css';
import styles from './CheckinPanel.module.css';
import { splitComment } from './checkinDraftStore';

export type CheckinMode = 'checkin' | 'shelve';

interface CheckinPanelProps {
  summary: string;
  description: string;
  onMessageChange: (message: { summary?: string; description?: string }) => void;
  includedCount: number;
  branchName: string;
  recentComments: string[];
  busy: boolean;
  onCheckin: () => Promise<boolean>;
  onShelve: () => Promise<boolean>;
}

const MODES: CheckinMode[] = ['checkin', 'shelve'];

export function CheckinPanel({
  summary,
  description,
  onMessageChange,
  includedCount,
  branchName,
  recentComments,
  busy,
  onCheckin,
  onShelve,
}: CheckinPanelProps) {
  const [mode, setMode] = useState<CheckinMode>('checkin');
  const canAct = includedCount > 0 && !busy;
  const { title: verb, icon: ModeIcon } = describeMode(mode);

  // A shelve is a detour: once it's done, the panel is back to checking in.
  const act = async (): Promise<void> => {
    if (mode === 'checkin') await onCheckin();
    else if (await onShelve()) setMode('checkin');
  };
  useShortcut('mod+enter', () => void act(), canAct);

  const changes = `${includedCount} ${includedCount === 1 ? 'change' : 'changes'}`;

  return (
    <div className={styles.panel}>
      <div className={styles.summaryField}>
        <input
          className={styles.summary}
          placeholder={mode === 'shelve' ? 'Shelve summary' : 'Summary'}
          value={summary}
          onChange={(event) => onMessageChange({ summary: event.target.value })}
          spellCheck
        />
        {recentComments.length > 0 && (
          <ActionDropdownMenu
            entries={recentComments.map((recent, index) => ({
              id: `recent.${index}`,
              label: recent.split('\n')[0]!,
              run: () => onMessageChange(splitComment(recent)),
            }))}
          >
            <IconButton size="small" className={styles.recent} icon={<History size={14} />} label="Recent comments" />
          </ActionDropdownMenu>
        )}
      </div>
      <textarea
        className={styles.description}
        placeholder="Description (optional)"
        value={description}
        onChange={(event) => onMessageChange({ description: event.target.value })}
        spellCheck
      />
      <div className={styles.actions}>
        <Button
          variant="primary"
          className={styles.act}
          icon={<ModeIcon size={14} />}
          disabled={!canAct}
          loading={busy}
          onClick={() => void act()}
        >
          {includedCount === 0 ? `Nothing to ${verb.toLowerCase()}` : `${verb} ${changes}`}
          {mode === 'checkin' && <span className={styles.branch}>to {branchName}</span>}
        </Button>
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger asChild>
            <Button variant="primary" className={styles.modeButton} icon={<ChevronDown size={14} />} disabled={busy} aria-label="Change mode" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={`${menuStyles.content} ${styles.modeMenu}`} align="end" side="top" sideOffset={4}>
              <DropdownMenu.Label className={styles.modeMenuLabel}>Mode</DropdownMenu.Label>
              {MODES.map((candidate) => {
                const { title, subtitle, icon: CandidateIcon } = describeMode(candidate);
                return (
                  <DropdownMenu.Item key={candidate} className={styles.modeItem} onSelect={() => setMode(candidate)}>
                    <CandidateIcon size={15} className={styles.modeIcon} />
                    <span className={styles.modeText}>
                      <span className={styles.modeTitle}>{title}</span>
                      <span className={styles.modeSubtitle}>{subtitle}</span>
                    </span>
                    {candidate === mode && <Check size={15} className={styles.modeCheck} />}
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

// The button already names the branch, so the subtitles stay one short line.
function describeMode(mode: CheckinMode): { title: string; subtitle: string; icon: Icon } {
  return mode === 'checkin'
    ? { title: 'Check in', subtitle: 'Create a new changeset', icon: GitCommitHorizontal }
    : { title: 'Shelve', subtitle: 'Put changes aside for later', icon: Archive };
}
