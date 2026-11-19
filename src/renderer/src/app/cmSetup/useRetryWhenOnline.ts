import { useEffect } from 'react';
import { retriesByItself, type CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { api } from '../../api/client';

/**
 * Tries the setup again as soon as the OS says the network is back, rather than at the main process's next retry
 * (`installRetries`), which may be minutes away.
 */
export function useRetryWhenOnline(status: CmRuntimeStatus): void {
  const waitsForNetwork = status.kind === 'failed' && retriesByItself(status.failure);
  useEffect(() => {
    if (!waitsForNetwork) return;
    const retry = (): void => void api.cmRuntime.retry();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [waitsForNetwork]);
}
