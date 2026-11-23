import type { ImageThread, LineThread, ModelThread } from './fileThreads';

/**
 * What a thread written on an earlier version of the file says of it in the code: placed at its line, unchanged since,
 * it is "Earlier version"; its line changed or gone, "Outdated", as GitHub says. The tooltip names the changeset it was
 * written in, when it was written in one changeset's diff.
 */
export function earlierTagOf(thread: LineThread, outdated: boolean): { label: string; tip: string } {
  const where = thread.root.changesetId === undefined ? 'an earlier version of this file' : `the file as changeset ${thread.root.changesetId} left it`;
  const several = thread.root.anchor.lastLine > thread.root.anchor.firstLine;
  if (outdated) return { label: 'Outdated', tip: `Written on ${where}: ${several ? 'its lines' : 'its line'} changed since` };
  return { label: 'Earlier version', tip: `Written on ${where}: ${several ? "these lines haven't" : "this line hasn't"} changed since` };
}

/**
 * What a thread written on an earlier version of an image says of it at its pin: "Earlier version", the spot it's on
 * kept, as an image has no lines to follow and what's there now may differ.
 */
export function imageEarlierTagOf(thread: ImageThread): { label: string; tip: string } {
  const where = thread.root.changesetId === undefined ? 'an earlier version of this image' : `the image as changeset ${thread.root.changesetId} left it`;
  return { label: 'Earlier version', tip: `Written on ${where}: what's here may have changed since` };
}

/**
 * What a thread written on an earlier version of a 3D model says of it at its pin: "Earlier version", shown on its part
 * as the part is now (what's there may have changed), or at its point when that part isn't in this version.
 */
export function modelEarlierTagOf(thread: ModelThread, partGone: boolean): { label: string; tip: string } {
  const where = thread.root.changesetId === undefined ? 'an earlier version of this model' : `the model as changeset ${thread.root.changesetId} left it`;
  return { label: 'Earlier version', tip: `Written on ${where}: ${partGone ? "its part isn't in this version" : "shown on its part as it is now"}` };
}
