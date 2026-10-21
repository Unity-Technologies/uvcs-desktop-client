import { BrowserWindow, nativeTheme } from 'electron';
import { windowChrome, type WindowChrome } from '@shared/windowChrome';
import type { SettingsStore } from '../settings/SettingsStore';
import { fitCaptionButtons } from './pageZoom';

/**
 * What the OS draws for the app takes the theme the user picked, not only the OS's: menus, native dialogs, the
 * Windows caption buttons (at the page's zoom) and a Linux title bar. The pages follow it too (`prefers-color-scheme`).
 */
export function followAppTheme(settings: SettingsStore, chrome: WindowChrome = windowChrome(process.platform)): void {
  const apply = (): void => {
    nativeTheme.themeSource = settings.get().theme;
  };
  apply();
  settings.onChanged((_settings, changes) => 'theme' in changes && apply());

  if (chrome !== 'overlay') return;
  nativeTheme.on('updated', () => {
    for (const window of BrowserWindow.getAllWindows()) fitCaptionButtons(window);
  });
}
