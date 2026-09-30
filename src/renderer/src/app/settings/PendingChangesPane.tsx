import type { PendingChangesFilter } from '@shared/domain/pendingChanges';
import { setReviewMode } from '../../features/review/reviewModeSetting';
import { Checkbox } from '../../ui/Checkbox';
import { useSession } from '../workspace/sessionStore';
import { SettingsGroup } from './SettingsGroup';
import { useSettings, useUpdateSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

/** What Changes shows and how it keeps up with the disk. */
export function PendingChangesPane() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
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
