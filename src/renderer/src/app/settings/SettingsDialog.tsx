import { Check, FileDiff, GitCommitVertical, HardDrive, Palette } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import type { AppSettings } from '@shared/domain/settings';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { NavItem } from '../../ui/nav/SidebarNav';
import { DefaultWorkspaceRootField } from './DefaultWorkspaceRootField';
import { THEMES } from './themes';
import { useSettings, useUpdateSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

export type SettingsSection = 'appearance' | 'pendingChanges' | 'checkin' | 'workspaces';

const SECTIONS: { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
  { id: 'pendingChanges', label: 'Pending changes', icon: <FileDiff size={15} /> },
  { id: 'checkin', label: 'Check in', icon: <GitCommitVertical size={15} /> },
  { id: 'workspaces', label: 'Workspaces', icon: <HardDrive size={15} /> },
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
          {section === 'appearance' && <AppearancePane settings={settings} updateSettings={updateSettings} />}
          {section === 'pendingChanges' && <PendingChangesPane settings={settings} updateSettings={updateSettings} />}
          {section === 'checkin' && <CheckinPane settings={settings} updateSettings={updateSettings} />}
          {section === 'workspaces' && <WorkspacesPane settings={settings} updateSettings={updateSettings} />}
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

function PendingChangesPane({ settings, updateSettings }: PaneProps) {
  const filter = settings.pendingChanges;
  const updateFilter = (changes: Partial<PendingChangesFilter>): void => updateSettings({ pendingChanges: { ...filter, ...changes } });

  return (
    <>
      <SettingsGroup title="Refresh">
        <Checkbox label="Refresh automatically when files change" checked={settings.autoRefresh} onChange={(autoRefresh) => updateSettings({ autoRefresh })} />
      </SettingsGroup>

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
    <SettingsGroup title="Folder for new workspaces">
      <DefaultWorkspaceRootField value={settings.defaultWorkspaceRoot} onChange={(defaultWorkspaceRoot) => updateSettings({ defaultWorkspaceRoot })} />
    </SettingsGroup>
  );
}
