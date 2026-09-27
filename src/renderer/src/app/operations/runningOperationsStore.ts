import { create } from 'zustand';
import type { OperationProgress } from '@shared/domain/operation';
import { nextProgressBar, SWEEP, type ProgressBarState } from './progressBar';

/** Operations that change which revisions the workspace has loaded. Only one of them runs at a time per workspace. */
export type WorkspaceChangingOperation = 'update' | 'switch';

export interface RunningOperation {
  id: string;
  workspacePath: string;
  kind?: WorkspaceChangingOperation;
  /** e.g. "Updating workspace" or "Switching to /main/task". */
  title: string;
  /** The latest progress reported, null until the first one. */
  progress: OperationProgress | null;
  /** How the progress bar moves, worked out once per report so every view of the operation glides the same way. */
  bar: ProgressBarState;
}

interface RunningOperationsStore {
  operations: RunningOperation[];
  start: (operation: Pick<RunningOperation, 'id' | 'workspacePath' | 'kind' | 'title'>) => void;
  report: (id: string, progress: OperationProgress) => void;
  finish: (id: string) => void;
}

/** The long operations in flight, so the UI can show them and refuse to start a conflicting one. */
export const useRunningOperationsStore = create<RunningOperationsStore>((set) => ({
  operations: [],
  start: (operation) => set((state) => ({ operations: [...state.operations, { ...operation, progress: null, bar: SWEEP }] })),
  report: (id, progress) =>
    set((state) => ({
      operations: state.operations.map((operation) =>
        operation.id === id ? { ...operation, progress, bar: nextProgressBar(operation.bar, progress, performance.now()) } : operation,
      ),
    })),
  finish: (id) => set((state) => ({ operations: state.operations.filter((operation) => operation.id !== id) })),
}));

/** The oldest operation running on the workspace, if any. */
export function useRunningOperation(workspacePath: string): RunningOperation | undefined {
  return useRunningOperationsStore((state) => state.operations.find((operation) => operation.workspacePath === workspacePath));
}

/**
 * What keeps an operation from starting on the workspace: for an update or a switch, any other operation on it; for
 * anything else (a checkin, a shelve, a merge), an update or a switch rewriting its files meanwhile.
 */
export function blockingOperation(operations: RunningOperation[], workspacePath: string, changesLoadedRevisions: boolean): RunningOperation | undefined {
  return operations.find((operation) => operation.workspacePath === workspacePath && (changesLoadedRevisions || operation.kind !== undefined));
}

export function operationById(id: string): RunningOperation | undefined {
  return useRunningOperationsStore.getState().operations.find((operation) => operation.id === id);
}

/** The operation while it runs; undefined once it's done. */
export function useOperation(id: string | undefined): RunningOperation | undefined {
  return useRunningOperationsStore((state) => state.operations.find((operation) => operation.id === id));
}
