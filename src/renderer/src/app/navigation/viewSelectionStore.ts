import { useCallback } from 'react';
import { create } from 'zustand';
import { EMPTY_SELECTION, type SelectionState } from '../../lib/selection';
import { useWorkspacePath } from '../workspace/useWorkspace';
import type { ViewId } from './views';

interface ViewSelectionStore {
  selections: ReadonlyMap<string, SelectionState>;
  set: (key: string, selection: SelectionState) => void;
}

const useViewSelectionStore = create<ViewSelectionStore>((set) => ({
  selections: new Map(),
  set: (key, selection) => set((state) => ({ selections: new Map(state.selections).set(key, selection) })),
}));

/**
 * The selection of a view's main list, kept while the view is away (views unmount when another one shows), so
 * coming back with ⌘1… or the sidebar finds the rows it left, ready for the arrows.
 */
export function useViewSelection(view: ViewId): [SelectionState, (selection: SelectionState) => void] {
  const key = selectionKey(useWorkspacePath(), view);
  const selection = useViewSelectionStore((state) => state.selections.get(key)) ?? EMPTY_SELECTION;
  const setSelection = useCallback((next: SelectionState) => useViewSelectionStore.getState().set(key, next), [key]);
  return [selection, setSelection];
}

/** Selects one row of a view from elsewhere, before going to it: the view opens on that row, scrolled to it. */
export function selectInView(workspacePath: string, view: ViewId, rowKey: string): void {
  useViewSelectionStore.getState().set(selectionKey(workspacePath, view), { selected: new Set([rowKey]), anchor: rowKey });
}

function selectionKey(workspacePath: string, view: ViewId): string {
  return `${workspacePath}\n${view}`;
}
