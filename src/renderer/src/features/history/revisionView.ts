import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { canAnnotate } from '@shared/domain/annotate';
import type { ItemType } from '@shared/domain/pendingChanges';

/** How the history shows the selected revision: what it changed, or who last changed each of its lines. */
export type RevisionView = 'diff' | 'annotate';

/** The view a revision shows in: the one picked, except that only text files can be annotated. */
export function shownRevisionView(picked: RevisionView, itemType: ItemType): RevisionView {
  return picked === 'annotate' && canAnnotate(itemType) ? 'annotate' : 'diff';
}

export function otherRevisionView(view: RevisionView): RevisionView {
  return view === 'diff' ? 'annotate' : 'diff';
}

interface RevisionViewStore {
  view: RevisionView;
  setView: (view: RevisionView) => void;
}

/** The view picked last, kept for every history and across sessions. */
export const useRevisionView = create<RevisionViewStore>()(
  persist(
    (set) => ({
      view: 'diff',
      setView: (view) => set({ view }),
    }),
    { name: 'history-revision-view' },
  ),
);
