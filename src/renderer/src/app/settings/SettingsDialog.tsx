import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import type { ThemePreference } from '@shared/domain/settings';
import { Button } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { useSettings, useUpdateSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

export function openSettingsDialog(): void {
  openDialog((close) => <SettingsDialog onClose={close} />);
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const updateFilter = (changes: Partial<PendingChangesFilter>): void =>
    updateSettings({ pendingChanges: { ...settings.pendingChanges, ...changes } });

  return (
    <Dialog title="Settings" width={520} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <section className={styles.section}>
        <h2 className={styles.heading}>Appearance</h2>
        <SegmentedControl<ThemePreference>
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          segments={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Pending changes</h2>
        <Checkbox label="Refresh automatically when files change" checked={settings.autoRefresh} onChange={(autoRefresh) => updateSettings({ autoRefresh })} />
        <Checkbox label="Show private files" checked={settings.pendingChanges.showPrivate} onChange={(showPrivate) => updateFilter({ showPrivate })} />
        <Checkbox label="Show ignored files" checked={settings.pendingChanges.showIgnored} onChange={(showIgnored) => updateFilter({ showIgnored })} />
        <Checkbox label="Show cloaked files" checked={settings.pendingChanges.showCloaked} onChange={(showCloaked) => updateFilter({ showCloaked })} />
        <Checkbox
          label="Show hidden changes"
          checked={settings.pendingChanges.showHiddenChanged}
          onChange={(showHiddenChanged) => updateFilter({ showHiddenChanged })}
        />
        <Checkbox
          label="Detect moved and renamed files"
          checked={settings.pendingChanges.detectLocalMoves}
          onChange={(detectLocalMoves) => updateFilter({ detectLocalMoves })}
        />
        <label className={styles.slider}>
          <span>Similarity to consider a file moved</span>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={settings.pendingChanges.moveSimilarityPercent}
            disabled={!settings.pendingChanges.detectLocalMoves}
            onChange={(event) => updateFilter({ moveSimilarityPercent: Number(event.target.value) })}
          />
          <span className={styles.sliderValue}>{settings.pendingChanges.moveSimilarityPercent}%</span>
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Check in</h2>
        <Checkbox
          label="Warn before checking in without a comment"
          checked={settings.warnOnEmptyComment}
          onChange={(warnOnEmptyComment) => updateSettings({ warnOnEmptyComment })}
        />
      </section>
    </Dialog>
  );
}
