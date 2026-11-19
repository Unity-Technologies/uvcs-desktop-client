import { detailsWidthOf, type DetailsWidthLimits } from '../../components/detailsPaneStore';

/**
 * The list of files beside a diff (`DiffBrowserLayout`): its default, until it's dragged, and its limits. The diff keeps
 * at least about a readable column of code (`restMin`) as the window narrows: a width left in a wide window gives way
 * first.
 */
export const DIFF_FILES_WIDTH: DetailsWidthLimits = { initial: 340, min: 220, max: 640, restMin: 480 };

/** Where every page's files beside a diff keep their width (a merge request, a code review, a changeset, a shelve, a branch): they all show the same list. */
export const PAGE_DIFF_FILES_WIDTH_KEY = 'diffFiles';
/** Where a dialog's files beside a diff keep theirs: a dialog is narrower than the window. */
export const DIALOG_DIFF_FILES_WIDTH_KEY = 'dialogDiffFiles';

/** Where the files' width is remembered in the details' store, by where the diff shows. */
export function diffFilesWidthKey(inDialog: boolean): string {
  return inDialog ? DIALOG_DIFF_FILES_WIDTH_KEY : PAGE_DIFF_FILES_WIDTH_KEY;
}

/** How wide a page's files beside a diff open: as they were last left. */
export function pageDiffFilesWidthOf(state: { widths: Record<string, number> }): number {
  return detailsWidthOf(state, PAGE_DIFF_FILES_WIDTH_KEY, DIFF_FILES_WIDTH);
}
