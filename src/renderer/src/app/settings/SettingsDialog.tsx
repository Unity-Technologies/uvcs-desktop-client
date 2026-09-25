import { Check, FileDiff, GitCommitVertical, GitMerge, HardDrive, Palette, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import type { AppSettings } from '@shared/domain/settings';
import type { PendingChangesOnSwitch } from '@shared/domain/switchWithChanges';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { NavItem } from '../../ui/nav/SidebarNav';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { setReviewMode } from '../../features/review/reviewModeSetting';
import { useSession } from '../workspace/sessionStore';
import { AccountsPane } from './AccountsPane';
import { DefaultWorkspaceRootField } from './DefaultWorkspaceRootField';
import { MergeToolsPane } from './MergeToolsPane';
import { THEMES } from './themes';
import { useSettings, useUpdateSettings } from './useSettings';
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
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

  return (
    <Dialog title="Settings" width={640} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <NavItem key={item.id} icon={item.icon} label={item.label} active={section === item.id} onClick={() => setSection(item.id)} />
          ))}
        </nav>
        <div className={styles.pane}>
          {section === 'appearance' && (
            <>
              <AppearancePane settings={settings} updateSettings={updateSettings} />
              <PeopleGroup settings={settings} updateSettings={updateSettings} />
            </>
          )}
          {section === 'pendingChanges' && <PendingChangesPane settings={settings} updateSettings={updateSettings} />}
          {section === 'checkin' && <CheckinPane settings={settings} updateSettings={updateSettings} />}
          {section === 'merge' && <MergeToolsPane />}
          {section === 'workspaces' && <WorkspacesPane settings={settings} updateSettings={updateSettings} />}
          {section === 'accounts' && <AccountsPane />}
        </div>
      </div>
    </Dialog>
  );
}

interface PaneProps {
  settings: AppSettings;
  updateSettings: (changes: Partial<AppSettings>) => void;
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{title}</h2>
      {children}
    </section>
  );
}

function AppearancePane({ settings, updateSettings }: PaneProps) {
  return (
    <SettingsGroup title="Theme">
      <div className={styles.choices} role="radiogroup" aria-label="Theme">
        {THEMES.map((theme) => {
          const selected = settings.theme === theme.value;
          const ThemeIcon = theme.icon;
          return (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={styles.choice}
              data-selected={selected}
              onClick={() => updateSettings({ theme: theme.value })}
            >
              <ThemeIcon size={18} />
              <span className={styles.choiceText}>
                <span className={styles.choiceLabel}>{theme.label}</span>
                <span className={styles.choiceDescription}>{theme.description}</span>
              </span>
              {selected && <Check size={14} />}
            </button>
          );
        })}
      </div>
    </SettingsGroup>
  );
}

function PeopleGroup({ settings, updateSettings }: PaneProps) {
  return (
    <SettingsGroup title="People">
      <Checkbox
        label="Show profile pictures from Gravatar (sends a hash of each email address to gravatar.com)"
        checked={settings.showGravatar}
        onChange={(showGravatar) => updateSettings({ showGravatar })}
      />
    </SettingsGroup>
  );
}

function PendingChangesPane({ settings, updateSettings }: PaneProps) {
  const filter = settings.pendingChanges;
  const updateFilter = (changes: Partial<PendingChangesFilter>): void => updateSettings({ pendingChanges: { ...filter, ...changes } });
  const workspacePath = useSession((state) => state.workspacePath);

  return (
    <>
      <SettingsGroup title="Refresh">
        <Checkbox label="Refresh automatically when files change" checked={settings.autoRefresh} onChange={(autoRefresh) => updateSettings({ autoRefresh })} />
      </SettingsGroup>

      {workspacePath && (
        <SettingsGroup title="Review">
          <Checkbox
            label="Review mode in this workspace: mark files as you review them, in Changes and every diff (R)"
            checked={settings.reviewModeWorkspaces.includes(workspacePath)}
            onChange={(on) => void setReviewMode(workspacePath, on)}
          />
        </SettingsGroup>
      )}

      <SettingsGroup title="What to show">
        <Checkbox label="Private files" checked={filter.showPrivate} onChange={(showPrivate) => updateFilter({ showPrivate })} />
        <Checkbox label="Ignored files" checked={filter.showIgnored} onChange={(showIgnored) => updateFilter({ showIgnored })} />
        <Checkbox label="Cloaked files" checked={filter.showCloaked} onChange={(showCloaked) => updateFilter({ showCloaked })} />
        <Checkbox label="Hidden changes" checked={filter.showHiddenChanged} onChange={(showHiddenChanged) => updateFilter({ showHiddenChanged })} />
      </SettingsGroup>

      <SettingsGroup title="Moved and renamed files">
        <Checkbox label="Detect moved and renamed files" checked={filter.detectLocalMoves} onChange={(detectLocalMoves) => updateFilter({ detectLocalMoves })} />
        <label className={styles.slider}>
          <span>Similarity to consider a file moved</span>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={filter.moveSimilarityPercent}
            disabled={!filter.detectLocalMoves}
            onChange={(event) => updateFilter({ moveSimilarityPercent: Number(event.target.value) })}
          />
          <span className={styles.sliderValue}>{filter.moveSimilarityPercent}%</span>
        </label>
      </SettingsGroup>
    </>
  );
}

function CheckinPane({ settings, updateSettings }: PaneProps) {
  return (
    <SettingsGroup title="Comments">
      <Checkbox
        label="Warn before checking in without a comment"
        checked={settings.warnOnEmptyComment}
        onChange={(warnOnEmptyComment) => updateSettings({ warnOnEmptyComment })}
      />
    </SettingsGroup>
  );
}

function WorkspacesPane({ settings, updateSettings }: PaneProps) {
  return (
    <>
      <SettingsGroup title="Folder for new workspaces">
        <DefaultWorkspaceRootField value={settings.defaultWorkspaceRoot} onChange={(defaultWorkspaceRoot) => updateSettings({ defaultWorkspaceRoot })} />
      </SettingsGroup>

      <SettingsGroup title="When switching with pending changes">
        <SegmentedControl<PendingChangesOnSwitch>
          value={settings.pendingChangesOnSwitch}
          onChange={(pendingChangesOnSwitch) => updateSettings({ pendingChangesOnSwitch })}
          segments={[
            { value: 'ask', label: 'Ask' },
            { value: 'leave', label: 'Always leave them' },
            { value: 'bring', label: 'Always bring them' },
          ]}
        />
        <Checkbox
          label="Restore left changes automatically when I come back"
          checked={settings.restoreLeftChangesAutomatically}
          onChange={(restoreLeftChangesAutomatically) => updateSettings({ restoreLeftChangesAutomatically })}
        />
      </SettingsGroup>

      <SettingsGroup title="Incoming changes">
        <Checkbox
          label="Notify me when someone checks in to my branch while the app is in the background"
          checked={settings.notifyOnIncoming}
          onChange={(notifyOnIncoming) => updateSettings({ notifyOnIncoming })}
        />
      </SettingsGroup>
    </>
  );
}
