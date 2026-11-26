import { createContext } from 'react';
import { pluralize } from '../../../lib/text';

/** How a file that is both text and rendered (an SVG, an OBJ) shows: its code, or what it draws (an image, a 3D model). */
export type CommentedRepresentation = 'text' | 'rendered';

/**
 * A place's comments on a file shown either way (docs/features/diff.md "Images written as text"): those on its lines
 * show in its code, those on a spot of what it draws (a point or an area of its image) there. How many each has, and the one a comment gone to asks
 * for, each time it's gone to: `key` names that time, unique in the window (a review's own counter restarts with each
 * of its pages, so the place's id goes in it too).
 */
export interface RepresentationComments {
  onText: number;
  onRendered: number;
  asked: { representation: CommentedRepresentation; key: string } | null;
}

export const RepresentationCommentsContext = createContext<RepresentationComments | null>(null);

/**
 * The line over a file shown one way when the other holds comments: how many, and the switch to them ("2 comments are
 * on the image", Show image). `rendered` is what the file draws. None when the other way holds none.
 */
export function otherRepresentationNotice(
  shown: CommentedRepresentation,
  rendered: RenderedKind,
  comments: RepresentationComments | null,
): { text: string; action: string; showing: CommentedRepresentation } | null {
  if (!comments) return null;
  const other: CommentedRepresentation = shown === 'text' ? 'rendered' : 'text';
  const count = other === 'rendered' ? comments.onRendered : comments.onText;
  if (count === 0) return null;
  const where = other === 'rendered' ? `the ${rendered}` : 'the code';
  return { text: `${pluralize(count, 'comment')} ${count === 1 ? 'is' : 'are'} on ${where}`, action: other === 'rendered' ? `Show ${rendered}` : 'Show code', showing: other };
}

/** What a file written as text draws: an image (an SVG) or a 3D model (an OBJ, an ASCII FBX). */
export type RenderedKind = 'image' | 'model';

/**
 * The view a comment gone to asks for, unless an earlier showing of the file took it already (`takenKey`): it applies
 * once, to the diff on screen, so going elsewhere and back finds the file as the user left it, not switched again.
 */
export function askToTake(asked: RepresentationComments['asked'] | undefined, takenKey: string | null): RepresentationComments['asked'] {
  return asked && asked.key !== takenKey ? asked : null;
}

/** The view shown: one asked for this file's versions (`versionsKey`) while it shows, else the user's for its type. */
export function shownRepresentation<T extends string>(preferred: T, override: { versionsKey: string; representation: T } | null, versionsKey: string): T {
  return override?.versionsKey === versionsKey ? override.representation : preferred;
}
