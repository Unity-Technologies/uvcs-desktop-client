import { create } from 'zustand';

/** Operations that change which revisions the workspace has loaded. Only one of them runs at a time per workspace. */
export type WorkspaceChangingOperation = 'update' | 'switch';

export interface RunningOperation {
  id: string;
  workspacePath: string;
  kind?: WorkspaceChangingOperation;
  /** e.g. "Updating workspace" or "Switching to /main/task". */
  title: string;
  /** The latest progress line, already made readable. */
  detail: string | null;
}

interface RunningOperationsStore {
  operations: RunningOperation[];
  start: (operation: RunningOperation) => void;
  report: (id: string, detail: string) => void;
  finish: (id: string) => void;
}

/** The long operations in flight, so the UI can show them and refuse to start a conflicting one. */
export const useRunningOperationsStore = create<RunningOperationsStore>((set) => ({
  operations: [],
  start: (operation) => set((state) => ({ operations: [...state.operations, operation] })),
  report: (id, detail) =>
    set((state) => ({ operations: state.operations.map((operation) => (operation.id === id ? { ...operation, detail } : operation)) })),
  finish: (id) => set((state) => ({ operations: state.operations.filter((operation) => operation.id !== id) })),
}));

/** The oldest operation running on the workspace, if any. */
export function useRunningOperation(workspacePath: string): RunningOperation | undefined {
  return useRunningOperationsStore((state) => state.operations.find((operation) => operation.workspacePath === workspacePath));
}

export function runningOperationOf(workspacePath: string): RunningOperation | undefined {
  return useRunningOperationsStore.getState().operations.find((operation) => operation.workspacePath === workspacePath);
}
