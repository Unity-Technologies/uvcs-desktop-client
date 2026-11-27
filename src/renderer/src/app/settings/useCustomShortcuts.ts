import { useEffect } from 'react';
import { setCustomShortcuts } from '../../lib/keymapStore';
import { useSettings } from './useSettings';

/** The window's shortcuts take the keys a person chose in Settings ▸ Keyboard, in this window or another. */
export function useCustomShortcuts(): void {
  const custom = useSettings().customShortcuts;
  useEffect(() => setCustomShortcuts(custom), [custom]);
}
