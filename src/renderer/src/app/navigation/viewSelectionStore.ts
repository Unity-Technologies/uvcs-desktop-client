import { useCallback } from 'react';
import { create } from 'zustand';
import { EMPTY_SELECTION, singleSelection, type SelectionState } from '../../lib/selection';
import { placeId, type Place } from '@shared/domain/place';
import { usePlace } from '../workspace/useWorkspace';
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
  const key = selectionKey(usePlace(), view);
  const selection = useViewSelectionStore((state) => state.selections.get(key)) ?? EMPTY_SELECTION;
  const setSelection = useCallback((next: SelectionState) => useViewSelectionStore.getState().set(key, next), [key]);
  return [selection, setSelection];
}

/** Selects one row of a view from elsewhere, before going to it: the view opens on that row, scrolled to it. */
export function selectInView(place: Place, view: ViewId, rowKey: string): void {
  useViewSelectionStore.getState().set(selectionKey(place, view), singleSelection(rowKey));
}

function selectionKey(place: Place, view: ViewId): string {
  return `${placeId(place)}\n${view}`;
}
