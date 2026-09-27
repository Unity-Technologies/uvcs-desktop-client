import { BrowserWindow, nativeTheme } from 'electron';
import { windowChrome } from '@shared/windowChrome';
import type { SettingsStore } from '../settings/SettingsStore';
import { captionButtons } from './titleBar';

/**
 * What the OS draws for the app takes the theme the user picked, not only the OS's: menus, native dialogs, the
 * Windows caption buttons and a Linux title bar. The pages follow it too (`prefers-color-scheme`).
 */
export function followAppTheme(settings: SettingsStore): void {
  const apply = (): void => {
    nativeTheme.themeSource = settings.get().theme;
  };
  apply();
  settings.onChanged((_settings, changes) => 'theme' in changes && apply());

  if (windowChrome(process.platform) !== 'overlay') return;
  nativeTheme.on('updated', () => {
    for (const window of BrowserWindow.getAllWindows()) window.setTitleBarOverlay(captionButtons(nativeTheme.shouldUseDarkColors));
  });
}
