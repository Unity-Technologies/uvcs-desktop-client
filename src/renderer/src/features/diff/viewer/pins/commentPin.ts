/**
 * A comment's pin, on an image or a 3D model: a speech bubble holding the avatar of who started it, its tip on the spot
 * it's about (`Spot`: a point or an area of an image, a point or a part of a model).
 */
export interface CommentPin<Spot> {
  key: string;
  spot: Spot;
  /** Who started it, whose avatar the bubble holds; none for a comment being written, which shows a plus. */
  author: string | null;
  /** The marker's tooltip, and what a screen reader hears. */
  tip: string;
  /** Something there is still open: the Open color, as a line's marker; a quiet gray once settled. */
  emphasized: boolean;
  /** Written on an earlier version, which may show something else there now: drawn dashed. */
  earlier: boolean;
  /** Its spot can still change (a comment being written): its bubble drags it. */
  movable: boolean;
}
