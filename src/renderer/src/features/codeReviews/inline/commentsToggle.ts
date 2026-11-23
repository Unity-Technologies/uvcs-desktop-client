/** Where a file's comments show: in its code, on its image, or both (an SVG, shown either way). */
export type CommentsPlace = 'code' | 'image' | 'both';

/** What the header's button says it does: hide or show the comments, where they are. */
export function commentsToggleLabel(shown: boolean, place: CommentsPlace): string {
  const verb = shown ? 'Hide comments' : 'Show comments';
  return place === 'code' ? `${verb} in the code` : place === 'image' ? `${verb} on the image` : verb;
}
