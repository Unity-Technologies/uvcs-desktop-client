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
  const key = `${useWorkspacePath()}\n${view}`;
  const selection = useViewSelectionStore((state) => state.selections.get(key)) ?? EMPTY_SELECTION;
  const setSelection = useCallback((next: SelectionState) => useViewSelectionStore.getState().set(key, next), [key]);
  return [selection, setSelection];
}
