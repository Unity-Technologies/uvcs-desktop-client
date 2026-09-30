import { Checkbox } from '../../ui/Checkbox';
import { SettingsChoice } from './SettingsChoice';
import { SettingsGroup } from './SettingsGroup';
import { THEMES } from './themes';
import { useSettings, useUpdateSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

/** How the app looks: the theme, and whether people show their profile pictures. */
export function AppearancePane() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();

  return (
    <>
      <SettingsGroup title="Theme">
        <div className={styles.choices} role="radiogroup" aria-label="Theme">
          {THEMES.map(({ value, label, description, icon: ThemeIcon }) => (
            <SettingsChoice
              key={value}
              icon={<ThemeIcon size={18} />}
              label={label}
              description={description}
              selected={settings.theme === value}
              onSelect={() => updateSettings({ theme: value })}
            />
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title="People">
        <Checkbox
          label="Show profile pictures from Gravatar (sends a hash of each email address to gravatar.com)"
          checked={settings.showGravatar}
          onChange={(showGravatar) => updateSettings({ showGravatar })}
        />
      </SettingsGroup>
    </>
  );
}
