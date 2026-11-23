/** Where a file's comments show: in its code, on its image or its 3D model, or both (an SVG, an OBJ, shown either way). */
export type CommentsPlace = 'code' | 'image' | 'model' | 'both';

/** What the header's button says it does: hide or show the comments, where they are. */
export function commentsToggleLabel(shown: boolean, place: CommentsPlace): string {
  const verb = shown ? 'Hide comments' : 'Show comments';
  switch (place) {
    case 'code':
      return `${verb} in the code`;
    case 'image':
      return `${verb} on the image`;
    case 'model':
      return `${verb} on the model`;
    case 'both':
      return verb;
  }
}
