import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SyncTargetStore {
  /** The remote repository each local repository was last synced with, keyed by repository spec. */
  remoteByRepository: Record<string, string>;
  setRemote: (repository: string, remote: string) => void;
}

export const useSyncTargetStore = create<SyncTargetStore>()(
  persist(
    (set) => ({
      remoteByRepository: {},
      setRemote: (repository, remote) =>
        set((state) => ({ remoteByRepository: { ...state.remoteByRepository, [repository]: remote } })),
    }),
    { name: 'sync-targets' },
  ),
);
