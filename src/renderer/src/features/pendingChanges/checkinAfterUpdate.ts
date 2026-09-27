import { create } from 'zustand';
import { pluralize } from '../../lib/text';

/** Where the workspace was when a checkin was rejected because the branch had moved. */
export interface RejectedCheckin {
  branch: string;
  loadedChangeset: number;
}

interface CheckinAfterUpdateStore {
  rejected: Record<string, RejectedCheckin>;
  remember: (workspacePath: string, rejected: RejectedCheckin) => void;
  forget: (workspacePath: string) => void;
}

/** Checkins waiting for the workspace to catch up with its branch, per workspace. */
export const useCheckinAfterUpdateStore = create<CheckinAfterUpdateStore>((set) => ({
  rejected: {},
  remember: (workspacePath, rejected) => set((state) => ({ rejected: { ...state.rejected, [workspacePath]: rejected } })),
  forget: (workspacePath) =>
    set((state) => {
      const { [workspacePath]: _forgotten, ...rest } = state.rejected;
      return { rejected: rest };
    }),
}));

interface LoadedState {
  branch: string | undefined;
  loadedChangeset: number | undefined;
}

/** "Updated to cs:43 · Check in your 4 changes now?" once the workspace updated past a rejected checkin on the same branch. */
export function checkinAfterUpdateMessage(rejected: RejectedCheckin | undefined, now: LoadedState, includedCount: number): string | null {
  if (!rejected || includedCount === 0 || now.branch !== rejected.branch) return null;
  if (now.loadedChangeset === undefined || now.loadedChangeset <= rejected.loadedChangeset) return null;
  return `Updated to cs:${now.loadedChangeset} · Check in your ${pluralize(includedCount, 'change')} now?`;
}
