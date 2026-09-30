import { diskText } from '../../../lib/lineBreaks';
import type { DiffContents } from './useDiffContents';

/**
 * The rules of a workspace file typed into in its diff (`useFileBuffer`). Besides the contents read, it holds the
 * file's text on disk as far as the edits go (`saved`: what was read, then what was saved) and the text the disk
 * doesn't have yet (`unsaved`, null when there is none).
 */
export interface BufferTexts {
  saved: string;
  unsaved: string | null;
}

/** A file typed into: the contents its diff shows (held still while it has unsaved edits) and its texts. */
export interface FileBufferState extends BufferTexts {
  shown: DiffContents;
}

/** The file as first read, with nothing typed. */
export function openedBuffer(contents: DiffContents): FileBufferState {
  return { shown: contents, saved: contents.right.text ?? '', unsaved: null };
}

/**
 * The buffer once the file's contents were read (anew, or the same): the diff follows them unless that would drop
 * unsaved edits (`followsDisk`). The same object while nothing changes.
 */
export function bufferAfterRead(buffer: FileBufferState, contents: DiffContents): FileBufferState {
  if (contents === buffer.shown || !followsDisk(contents.right.text ?? '', buffer.unsaved)) return buffer;
  return openedBuffer(contents);
}

/** The buffer after the editor's text changed (lone CRs shown as LFs). */
export function bufferAfterEdit(buffer: FileBufferState, editorText: string): FileBufferState {
  return { ...buffer, unsaved: unsavedAfterEdit(editorText, buffer.saved) };
}

/** The buffer once `written` is on disk; what was typed while it was written stays unsaved. */
export function bufferAfterSave(buffer: FileBufferState, written: string): FileBufferState {
  return { ...buffer, saved: written, unsaved: unsavedAfterSave(buffer.unsaved, written) };
}

/**
 * The buffer once its unsaved edits are dropped, and the text the editor goes back to: the saved text, unless newer
 * contents were read meanwhile (`latest`), which the diff then follows instead.
 */
export function bufferAfterDiscard(buffer: FileBufferState, latest: DiffContents): { buffer: FileBufferState; editorText: string | null } {
  return { buffer: { ...buffer, unsaved: null }, editorText: latest === buffer.shown ? buffer.saved : null };
}

/** Whether saving `written` left the file as its loaded revision (the diff compares against it and shows no changes). */
export function savedAsBase(contents: DiffContents, written: string): boolean {
  return contents.original.kind === 'workspaceBase' && written === contents.left.text;
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
