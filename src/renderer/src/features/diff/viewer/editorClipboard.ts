import { api } from '../../../api/client';

/** The editor the clipboard acts on: focused first, so the page's clipboard event lands on its content. */
interface FocusableEditor {
  focus: () => void;
}

export type ClipboardAction = 'cut' | 'copy' | 'paste';

/**
 * The code menu's Cut, Copy and Paste on the text typed into run Pierre's own clipboard handlers, as ⌘X, ⌘C and ⌘V do:
 * its `copy`, `cut` and `paste` listeners on the editor's content element take the clipboard's multi-caret pieces,
 * copy a bare caret's whole line, and paste in the document's own line breaks (`TextDocument.normalizeEol`).
 *
 * What makes the page's clipboard events land there (Pierre 1.6.1): `Editor.focus()` (`#focus`) puts the window's
 * selection inside the content element at once (`#setWindowSelection`), and only moves DOM focus there later
 * (`queueRender`). `document.execCommand('copy' | 'cut')` fires its event where the selection is, so it reaches
 * Pierre's listeners because the selection sits in the content, not because the content has focus yet.
 *
 * Chromium refuses a page's paste, so Paste asks the window to paste (`windows.pasteClipboard`, Electron's
 * `webContents.paste`), which lands where focus is once it arrives. The menu closing gives focus back to its trigger
 * (Radix's close autofocus) while Pierre focuses the content on its next render: whichever comes last, the paste
 * reaches the editor, as the trigger holds the editor and `focusAfterMenu` leaves a caret in it alone.
 */
export function runEditorClipboard(action: ClipboardAction, editor: FocusableEditor): void {
  editor.focus();
  if (action === 'paste') void api.windows.pasteClipboard();
  else document.execCommand(action);
}
