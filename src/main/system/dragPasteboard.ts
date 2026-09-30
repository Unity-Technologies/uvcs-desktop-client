import { execFile } from 'node:child_process';

/**
 * Reads the path of the file or folder on macOS's drag pasteboard, as JavaScript for Automation. Chromium hides a
 * drag's files from the page until the drop, but the drag pasteboard holds them from the start. Finder writes a file
 * reference URL (`file:///.file/id=…`), so it is turned into a path URL before taking its path.
 */
export const DRAG_PASTEBOARD_SCRIPT = [
  'ObjC.import("AppKit");',
  'var url = $.NSPasteboard.pasteboardWithName($.NSPasteboardNameDrag).stringForType("public.file-url");',
  'url.isNil() ? "" : ObjC.unwrap($.NSURL.URLWithString(url).filePathURL.path);',
].join(' ');

/** A drag still running when `osascript` hasn't answered by then gets the neutral words. It answers in about 60 ms. */
const READ_TIMEOUT_MS = 1500;

/** The path `osascript` printed; null when the pasteboard held no file. */
export function parseDraggedPath(output: string): string | null {
  const path = output.trim();
  return path.startsWith('/') ? path : null;
}

export type RunOsascript = (args: string[]) => Promise<string>;

const runOsascript: RunOsascript = (args) =>
  new Promise((resolve, reject) => {
    execFile('osascript', args, { timeout: READ_TIMEOUT_MS }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
  });

/** The path being dragged, on macOS only: other systems have no drag pasteboard to read before the drop. */
export async function readDraggedPath(platform: NodeJS.Platform, run: RunOsascript = runOsascript): Promise<string | null> {
  if (platform !== 'darwin') return null;
  try {
    return parseDraggedPath(await run(['-l', 'JavaScript', '-e', DRAG_PASTEBOARD_SCRIPT]));
  } catch {
    return null;
  }
}
