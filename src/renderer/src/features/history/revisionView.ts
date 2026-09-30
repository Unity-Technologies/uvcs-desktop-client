import { useCallback, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { canAnnotate } from '@shared/domain/annotate';
import type { ItemType } from '@shared/domain/pendingChanges';
import type { FileView } from '../annotate/fileView';

/** How the history shows the selected revision: what it changed, or who last changed each of its lines. */
export type RevisionView = FileView;

/** The view a revision shows in: the one picked, except that only text files can be annotated. */
export function shownRevisionView(picked: RevisionView, itemType: ItemType): RevisionView {
  return picked === 'annotate' && canAnnotate(itemType) ? 'annotate' : 'diff';
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

/**
 * A history page's view: the one it was opened with (`annotatedHistory` opens it annotated) until one is picked, so
 * opening to annotate doesn't change what plain histories open with; a view picked is remembered for every history.
 */
export function usePageRevisionView(openedWith: RevisionView | undefined): [RevisionView, (picked: RevisionView) => void] {
  const remembered = useRevisionView((state) => state.view);
  const remember = useRevisionView((state) => state.setView);
  const [opened, setOpened] = useState(openedWith);
  const pick = useCallback(
    (picked: RevisionView) => {
      setOpened(undefined);
      remember(picked);
    },
    [remember],
  );
  return [opened ?? remembered, pick];
}
