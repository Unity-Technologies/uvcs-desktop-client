import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Archive, Check, ChevronDown, GitCommitHorizontal } from 'lucide-react';
import type { Icon } from '../../lib/actions';
import { Button } from '../../ui/Button';
import menuStyles from '../../ui/menu/Menu.module.css';
import type { CheckinMode } from './checkinButton';
import styles from './CheckinPanel.module.css';

const MODES: CheckinMode[] = ['checkin', 'shelve'];

/** The caret beside the check-in button: whether it checks in or shelves. */
export function CheckinModeMenu({ mode, disabled, onChange }: { mode: CheckinMode; disabled: boolean; onChange: (mode: CheckinMode) => void }) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="primary" className={styles.modeButton} icon={<ChevronDown size={14} />} disabled={disabled} aria-label="Change mode" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={`${menuStyles.content} ${styles.modeMenu}`} align="end" side="top" sideOffset={4}>
          <DropdownMenu.Label className={styles.modeMenuLabel}>Mode</DropdownMenu.Label>
          {MODES.map((candidate) => {
            const { title, subtitle, icon: CandidateIcon } = describeMode(candidate);
            return (
              <DropdownMenu.Item key={candidate} className={styles.modeItem} onSelect={() => onChange(candidate)}>
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
  );
}

// The button already names the branch, so the subtitles stay one short line.
export function describeMode(mode: CheckinMode): { title: string; subtitle: string; icon: Icon } {
  return mode === 'checkin'
    ? { title: 'Check in', subtitle: 'Create a new changeset', icon: GitCommitHorizontal }
    : { title: 'Shelve', subtitle: 'Put changes aside for later', icon: Archive };
}
