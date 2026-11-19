import { detailsWidthOf, type DetailsWidthLimits } from '../../components/detailsPaneStore';

/** The list of files beside a diff (`DiffBrowserLayout`): its default, until it's dragged, and its limits. */
export const DIFF_FILES_WIDTH: DetailsWidthLimits = { initial: 340, min: 220, max: 640 };

/**
 * Where the files' width is remembered in the details' store: one width for every page's diff (a merge request, a code
 * review, a changeset, a shelve, a branch), as they all show the same list; a dialog's apart, as it's narrower.
 */
export function diffFilesWidthKey(inPage: boolean): string {
  return inPage ? 'diffFiles' : 'dialogDiffFiles';
}

/** How wide a page's files beside a diff open: as they were last left. */
export function pageDiffFilesWidthOf(state: { widths: Record<string, number> }): number {
  return detailsWidthOf(state, diffFilesWidthKey(true), DIFF_FILES_WIDTH);
}
