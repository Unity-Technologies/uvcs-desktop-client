import { useEffect } from 'react';
import { api } from '../../api/client';

/**
 * Tells the main process this window explores the repository while it shows it (`windows.exploring`), as watching a
 * workspace tells it a window shows that one: one window per place, the Window menu, the session saved, its page
 * windows and its branch names kept go by it.
 */
export function useRepositoryShown(repository: string): void {
  useEffect(() => {
    void api.windows.exploring(repository);
    return () => void api.windows.exploring(null);
  }, [repository]);
}
