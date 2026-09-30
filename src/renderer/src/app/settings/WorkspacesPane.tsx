import type { PendingChangesOnSwitch } from '@shared/domain/switchWithChanges';
import { Checkbox } from '../../ui/Checkbox';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { DefaultWorkspaceRootField } from './DefaultWorkspaceRootField';
import { SettingsGroup } from './SettingsGroup';
import { useSettings, useUpdateSettings } from './useSettings';

/** Where new workspaces go, what a switch does with pending changes, and incoming notifications. */
export function WorkspacesPane() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

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
