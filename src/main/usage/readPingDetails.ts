import { nativeTheme, screen } from 'electron';
import { physicalSize, type PingDetails } from './usageEventArgs';

/** The theme shown and the primary display's size, as Electron tells them. */
export function readPingDetails(): PingDetails {
  const { size, scaleFactor } = screen.getPrimaryDisplay();
  return { dark: nativeTheme.shouldUseDarkColors, screen: physicalSize(size, scaleFactor) };
}
