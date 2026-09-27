import { diskText } from '../../../lib/lineBreaks';

/**
 * The rules of a workspace file typed into in its diff (`useFileBuffer`). Besides the contents read, it holds the
 * file's text on disk as far as the edits go (`saved`: what was read, then what was saved) and the text the disk
 * doesn't have yet (`unsaved`, null when there is none).
 */
export interface BufferTexts {
  saved: string;
  unsaved: string | null;
}

/**
 * Whether the diff takes contents read anew from disk: always without unsaved edits, and with some only when the
 * disk reached them (they were just saved). Otherwise it holds still, so no edit is lost.
 */
export function followsDisk(onDisk: string, unsaved: string | null): boolean {
  return unsaved === null || onDisk === unsaved;
}

/** The file changed on disk since it was read or saved, while it had unsaved edits. */
export function changedOnDisk(onDisk: string, { saved, unsaved }: BufferTexts): boolean {
  return unsaved !== null && onDisk !== saved;
}

/**
 * The unsaved text after an edit, from the editor's text (lone CRs shown as LFs): in the file's own line breaks, and
 * none once it's the saved text again.
 */
export function unsavedAfterEdit(editorText: string, saved: string): string | null {
  const text = diskText(editorText, saved);
  return text === saved ? null : text;
}

/** What stays unsaved once `written` is on disk: typing may have gone on while it was written. */
export function unsavedAfterSave(unsaved: string | null, written: string): string | null {
  return unsaved === written ? null : unsaved;
}
