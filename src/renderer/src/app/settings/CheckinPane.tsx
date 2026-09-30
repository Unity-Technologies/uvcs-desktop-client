import { Checkbox } from '../../ui/Checkbox';
import { SettingsGroup } from './SettingsGroup';
import { useSettings, useUpdateSettings } from './useSettings';

/** What checking in asks before it runs. */
export function CheckinPane() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

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
