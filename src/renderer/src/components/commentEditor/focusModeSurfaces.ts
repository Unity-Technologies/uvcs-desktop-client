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

/** The larger editor a surface offers. */
export interface FocusModeExperience {
  layout: FocusModeLayout;
  /** What it edits: a changeset's title over its description (`CommentFocusGroup`), one description, or none (one line). */
  fields: 'titleAndDescription' | 'description' | 'none';
  /** The toolbar strip and the hints caption: only in the larger editor, the field compact until then. */
  toolbar: 'inFocusMode';
  hints: 'inFocusMode';
}

const FIELDS: Record<CommentSurface, FocusModeExperience['fields']> = {
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

/**
 * The one larger editor, the same everywhere: the check-in's panel over the window (in a dialog too, above it), its
 * toolbar and hints only there; a changeset's comment as its title over its description, as the check-in writes it.
 */
export function focusModeFor(surface: CommentSurface): FocusModeExperience {
  return { layout: focusModeLayout(), fields: FIELDS[surface], toolbar: 'inFocusMode', hints: 'inFocusMode' };
}
