import { samePlace, type Place } from '@shared/domain/place';
import { create } from 'zustand';
import { detailsHidden, useDetailsPaneStore } from '../../components/detailsPaneStore';
import { otherFileView, type FileView } from '../annotate/fileView';

/** The Files view's details panel (`ListWithDetails`, `DetailsToggleButton`), where the selected file shows. */
export const FILES_DETAILS_KEY = 'filesTree';

/** A path to select and scroll to in one place's Files (a workspace's tree, or a repository's), with the others to select (moved items). */
export interface RevealRequest {
  place: Place;
  path: string;
  selected?: string[];
}

interface FilesViewStore {
  /** What the selected file shows: its comparison (`itemComparison`), or its annotations. Kept as the selection moves. */
  fileView: FileView;
  /** The reveal the Files view takes next, e.g. after creating or renaming an item; `revealed` once done. */
  revealRequest: RevealRequest | null;
  setFileView: (view: FileView) => void;
  requestReveal: (place: Place, path: string, selected?: string[]) => void;
  /** Forgets the request once revealed; a newer one, asked meanwhile, stays for the view to take next. */
  revealed: (request: RevealRequest) => void;
}

export const useFilesViewStore = create<FilesViewStore>((set) => ({
  fileView: 'diff',
  revealRequest: null,
  setFileView: (fileView) => set({ fileView }),
  requestReveal: (place, path, selected) => set({ revealRequest: { place, path, selected } }),
  revealed: (request) => set((state) => (state.revealRequest === request ? { revealRequest: null } : state)),
}));

/**
 * Shows the selected file as `view`, and the details it shows in if they were hidden: Annotate or Show changes, asked
 * from a menu, the palette or a key, would otherwise change a panel no one sees, and seem to do nothing.
 */
export function showFileView(view: FileView): void {
  useFilesViewStore.getState().setFileView(view);
  useDetailsPaneStore.getState().showDetails(FILES_DETAILS_KEY);
}

/**
 * What the Annotate command shows: the other of "Diff | Annotate" while the details show the file; the file annotated
 * while they're hidden, where the diff switched to would be as unseen as the annotations were.
 */
export function fileViewForAnnotateCommand(current: FileView, detailsAreHidden: boolean): FileView {
  return detailsAreHidden ? 'annotate' : otherFileView(current);
}

/** Annotates the selected file, or goes back to its diff (`fileViewForAnnotateCommand`), in details that show. */
export function toggleAnnotated(): void {
  const hidden = detailsHidden(useDetailsPaneStore.getState(), FILES_DETAILS_KEY);
  showFileView(fileViewForAnnotateCommand(useFilesViewStore.getState().fileView, hidden));
}

/**
 * The reveal for this place's tree: none while it was asked in another, whose folders this tree would list
 * (expanding them runs a `cm ls` of a path the place doesn't have).
 */
export function revealRequestIn(state: Pick<FilesViewStore, 'revealRequest'>, place: Place): RevealRequest | null {
  const request = state.revealRequest;
  return request && samePlace(request.place, place) ? request : null;
}

export function useRevealRequest(place: Place): RevealRequest | null {
  return useFilesViewStore((state) => revealRequestIn(state, place));
}
