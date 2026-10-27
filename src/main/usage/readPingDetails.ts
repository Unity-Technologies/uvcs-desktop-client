import { nativeTheme, screen } from 'electron';
import type { PingDetails } from './usageEventArgs';

/** The theme shown and the primary display's size in physical pixels, as the other GUIs measure it. */
export function readPingDetails(): PingDetails {
  const { size, scaleFactor } = screen.getPrimaryDisplay();
  return {
    dark: nativeTheme.shouldUseDarkColors,
    screen: { width: Math.round(size.width * scaleFactor), height: Math.round(size.height * scaleFactor) },
  };
}
