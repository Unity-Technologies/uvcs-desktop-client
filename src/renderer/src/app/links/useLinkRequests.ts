import { useEffect } from 'react';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { openLink } from './openLink';

/**
 * Opens the links the main process hands this window: the one waiting as it opens (a link launched the app, or another
 * window opened this one for it) and each the OS hands it while it runs (`linkRequested`).
 */
export function useLinkRequests(): void {
  const openHanded = async (): Promise<void> => {
    const link = await api.windows.takeLink();
    if (link) await openLink(link);
  };

  useEffect(() => {
    void openHanded();
    // Only the link waiting as the window opens; later ones arrive as events.
  }, []);
  useUvcsEvent('linkRequested', () => void openHanded());
}
