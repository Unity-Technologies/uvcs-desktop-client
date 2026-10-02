import type { DiffHunksRenderer, FileDiff } from '@pierre/diffs';

/**
 * How much text (both versions together) a diff typed into renders whole again once typing pauses, to mark the words
 * that changed. Rendering whole highlights both versions on the main thread, as the diff did when it opened (about
 * 2 ms a KB: 0.07 s for 2 x 16 KB, 0.22 s for 2 x 50 KB, 0.7 s for 2 x 156 KB): past this (about 0.1 s), the marks
 * catch up when the file is saved.
 */
export const MAX_WORD_MARKS_REFRESHED_CHARS = 40_000;

/** Whether a diff of these texts typed into marks the words that changed once typing pauses, not only once saved. */
export function refreshesWordMarksWhileTyping(original: string, current: string): boolean {
  return original.length + current.length <= MAX_WORD_MARKS_REFRESHED_CHARS;
}

/**
 * Makes Pierre (1.5.1) mark the words that changed in a diff typed into, as it does once it's saved. While the editor
 * holds the diff (its edit session), Pierre rebuilds only the rows typed into, from the editor's tokens and with no
 * word marks, and keeps the other side's rows, marks and all, as they were: a line typed into showed as changed but
 * none of its words, and the original's line kept marking the words it marked before. This drops the rows the diff's
 * renderer keeps (`clearRenderCache`, as Pierre does itself when a collapsed region opens while typing) and renders
 * the diff again: both versions are highlighted anew, word marks included, in the markup the editor works with, and the
 * render ends by handing the editor its rows back, so the caret, selection and undo stay as they were.
 * `pierreWordMarks.test.ts` fails when an update moves what this reaches.
 */
export function refreshWordMarks(fileDiff: Pick<FileDiff, 'rerender'>): void {
  (fileDiff as unknown as RenderedFileDiff).hunksRenderer.clearRenderCache();
  fileDiff.rerender();
}

/** The component's member this reaches: protected. */
interface RenderedFileDiff {
  hunksRenderer: DiffHunksRenderer;
}
