import { focusModeLayout, type FocusModeLayout } from './focusMode';

/** Every place a comment is written (docs/features/rich-comments.md, "The larger editor"). */
export const COMMENT_SURFACES = [
  'checkin',
  'editCommentDialog',
  'changesetDetails',
  'namedObjectDetails',
  'newBranch',
  'newLabel',
  'newAttribute',
  'mergeComment',
  'codeReviewTitle',
] as const;

export type CommentSurface = (typeof COMMENT_SURFACES)[number];

/**
 * The larger editor a surface offers: one frame for all (`CommentFocusGroup`'s panel), padded, the description a
 * bordered box with the toolbar as its top strip and the hints as a caption under it; a changeset's comment (and a
 * shelve's, the same dialog) adds its title field on top. Out of it, every field is compact: no toolbar, no hints.
 */
export interface FocusModeExperience {
  /** A one-line comment (a merge's, a code review's title) has none. */
  offered: boolean;
  title: boolean;
  layout: FocusModeLayout;
  toolbar: 'strip';
  hints: 'caption';
}

type Fields = 'titleAndDescription' | 'description' | 'none';

const FIELDS: Record<CommentSurface, Fields> = {
  checkin: 'titleAndDescription',
  editCommentDialog: 'titleAndDescription',
  changesetDetails: 'titleAndDescription',
  namedObjectDetails: 'description',
  newBranch: 'description',
  newLabel: 'description',
  newAttribute: 'description',
  mergeComment: 'none',
  codeReviewTitle: 'none',
};

/** The one larger editor, the same everywhere: the check-in's panel over the window (in a dialog too, above it). */
export function focusModeFor(surface: CommentSurface): FocusModeExperience {
  const fields = FIELDS[surface];
  return { offered: fields !== 'none', title: fields === 'titleAndDescription', layout: focusModeLayout(), toolbar: 'strip', hints: 'caption' };
}
