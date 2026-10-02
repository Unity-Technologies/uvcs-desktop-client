import type { SyntaxHighlighting } from './syntaxHighlighting';

interface Attachment {
  editable: boolean;
  highlighting: SyntaxHighlighting;
  /** The diff Pierre had highlighted in the editor's markup (`isReadyToEdit`), or was told to edit at once. */
  readyFor: unknown;
  /** The diff Pierre is given to show. */
  shown: unknown;
}

/**
 * How long a click in a diff (or ⌘E) waits for the workers' colors before the editor attaches anyway, Pierre then
 * highlighting the diff on the main thread. The workers take about 1.7 s for 2 x 190 KB of TypeScript, the longest an
 * editable diff they highlight takes (`MAX_HIGHLIGHTED_CHARS`); one more file queued before it (one worker) can double
 * that. Only a worker that failed should get here.
 */
export const MAX_WAIT_FOR_COLORS_MS = 5_000;

/**
 * Whether the editor is attached to the diff shown. One highlighted in Pierre's workers gets it only once that diff is
 * highlighted, or after a click into it waited too long for that (`MAX_WAIT_FOR_COLORS_MS`): attached earlier, Pierre
 * would highlight the whole diff again on the main thread, freezing the app for up to 1.7 s.
 */
export function attachesEditor({ editable, highlighting, readyFor, shown }: Attachment): boolean {
  if (!editable) return false;
  return highlighting !== 'background' || readyFor === shown;
}

/** The modified text a diff typed into was last shown from, with what was read and typed then. */
export interface HeldText {
  modified: string;
  held: string;
  current: string;
}

/**
 * The modified text to show the diff from. Saving reads back the text the editor holds; showing the diff anew from it
 * would end the editor's session (Pierre replaces it, highlighting the diff again on the main thread and dropping the
 * caret) though nothing on screen changes. So the diff keeps the text it was shown from while what's read is what the
 * editor already held, and takes any other text read (the file changed on disk, a discard wrote it).
 */
export function heldModifiedText(previous: HeldText | undefined, modified: string): string {
  if (!previous || modified === previous.modified) return previous?.held ?? modified;
  return modified === previous.current ? previous.held : modified;
}
