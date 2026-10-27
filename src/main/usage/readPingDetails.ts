import { nativeTheme, screen } from 'electron';
import { physicalSize, type PingDetails } from './usageEventArgs';

/** The theme shown and the primary display's size, as Electron tells them. */
export function readPingDetails(): PingDetails {
  const display = screen.getPrimaryDisplay();
  const windowsScreenSize = () => screen.dipToScreenRect(null, display.bounds);
  return { dark: nativeTheme.shouldUseDarkColors, screen: physicalSize(process.platform, display, windowsScreenSize) };
}
