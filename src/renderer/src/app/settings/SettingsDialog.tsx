import { FileDiff, GitCommitVertical, GitMerge, HardDrive, Palette, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { NavItem } from '../../ui/nav/SidebarNav';
import { AccountsPane } from './AccountsPane';
import { AppearancePane } from './AppearancePane';
import { CheckinPane } from './CheckinPane';
import { MergeToolsPane } from './MergeToolsPane';
import { PendingChangesPane } from './PendingChangesPane';
import { WorkspacesPane } from './WorkspacesPane';
import styles from './SettingsDialog.module.css';

export type SettingsSection = 'appearance' | 'pendingChanges' | 'checkin' | 'merge' | 'workspaces' | 'accounts';

const SECTIONS: { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { id: 'pendingChanges', label: 'Pending changes', icon: <FileDiff size={15} /> },
  { id: 'checkin', label: 'Check in', icon: <GitCommitVertical size={15} /> },
  { id: 'merge', label: 'Merge', icon: <GitMerge size={15} /> },
  { id: 'workspaces', label: 'Workspaces', icon: <HardDrive size={15} /> },
  { id: 'accounts', label: 'Accounts', icon: <Users size={15} /> },
];

export function openSettingsDialog(): void {
  openSettingsDialogAt('appearance');
}

export function openSettingsDialogAt(section: SettingsSection): void {
  openDialog((close) => <SettingsDialog initialSection={section} onClose={close} />);
}

function SettingsDialog({ initialSection, onClose }: { initialSection: SettingsSection; onClose: () => void }) {
  const [section, setSection] = useState(initialSection);

  return (
    <Dialog title="Settings" width={640} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={section === item.id} onClick={() => setSection(item.id)} />
          ))}
        </nav>
        <div className={styles.pane}>
          {section === 'appearance' && <AppearancePane />}
          {section === 'pendingChanges' && <PendingChangesPane />}
          {section === 'checkin' && <CheckinPane />}
          {section === 'merge' && <MergeToolsPane />}
          {section === 'workspaces' && <WorkspacesPane />}
          {section === 'accounts' && <AccountsPane />}
        </div>
      </div>
    </Dialog>
  );
}
