/**
 * Every keyboard shortcut of the app, in one place: bindings read their keys from here (`hotkey`), and the shortcuts
 * sheet lists them, including the contextual ones of views that aren't mounted. `shortcutRegistry.test.ts` fails when
 * a shortcut is written anywhere else, so the sheet can't drift from what the keys do.
 *
 * Keys are written as in `lib/shortcuts.ts` (`mod+shift+k`); the first one is the binding, any others are alternatives.
 * `mod` is ⌘ on macOS and Ctrl elsewhere; a shortcut takes other keys on Windows and Linux (`keysOffMac`) where
 * their conventions differ (Alt+← goes back, Delete deletes, Ctrl+H is History as in their browsers since Ctrl+Y is
 * Redo) or where the Mac's would be AltGr: Ctrl+Alt types characters on most European layouts (Ctrl+Alt+Z is ż in
 * Polish), so no shortcut uses it there.
 */
import { isMac } from './platform';

export const SHORTCUT_AREAS = [
  'General',
  'Go to',
  'Lists',
  'Changes',
  'Diff',
  'Branch Explorer',
  'Files',
  'History',
  'Annotate',
  'Merge',
  'Command palette',
  'Image diff',
  'Command log',
] as const;

export type ShortcutArea = (typeof SHORTCUT_AREAS)[number];

export interface ShortcutDefinition {
  area: ShortcutArea;
  label: string;
  keys: readonly [string, ...string[]];
  /** The keys on Windows and Linux, when they aren't `keys`. */
  keysOffMac?: readonly [string, ...string[]];
  /** Windows and Linux only. */
  offMacOnly?: true;
  /** The command a native menu item runs; its accelerator must be the first key. */
  commandId?: string;
}

export const SHORTCUTS = {
  commandPalette: { area: 'General', label: 'Command palette', keys: ['mod+k', 'mod+shift+p'], commandId: 'app.commandPalette' },
  shortcuts: { area: 'General', label: 'Keyboard shortcuts', keys: ['?', 'mod+/'] },
  settings: { area: 'General', label: 'Settings', keys: ['mod+,'], commandId: 'app.settings' },
  back: { area: 'General', label: 'Back', keys: ['mod+['], keysOffMac: ['alt+left'] },
  refresh: { area: 'General', label: 'Refresh', keys: ['mod+r'], commandId: 'workspace.refresh' },
  updateWorkspace: { area: 'General', label: 'Update workspace', keys: ['mod+shift+u'], commandId: 'workspace.update' },
  switchBranch: { area: 'General', label: 'Switch branch', keys: ['mod+shift+w'] },
  newBranch: { area: 'General', label: 'New branch', keys: ['mod+b'] },
  mergeFromBranch: { area: 'General', label: 'Merge from branch', keys: ['mod+shift+m'] },
  goToFile: { area: 'General', label: 'Go to file', keys: ['mod+p'] },
  openWorkspace: { area: 'General', label: 'Open another workspace', keys: ['mod+shift+o'], commandId: 'workspace.open' },
  newWindow: { area: 'General', label: 'New window', keys: ['mod+n'], commandId: 'app.newWindow' },
  commandLog: { area: 'General', label: 'Command log', keys: ['mod+shift+l'], commandId: 'app.commandLog' },
  toggleSidebar: { area: 'General', label: 'Collapse or expand the sidebar', keys: ['mod+\\'] },
  appMenu: { area: 'General', label: 'Open the menu', keys: ['f10'], offMacOnly: true },
  saveComment: { area: 'General', label: 'Save an edited comment', keys: ['mod+enter'] },

  listFilter: { area: 'Lists', label: "Filter the view's list (/ from outside a text field)", keys: ['mod+f', '/'] },
  listMove: { area: 'Lists', label: 'Move the selection', keys: ['up', 'down'] },
  listExtend: { area: 'Lists', label: 'Extend the selection', keys: ['shift+up', 'shift+down'] },
  listEnds: { area: 'Lists', label: 'First or last row', keys: ['home', 'end'] },
  listOpen: { area: 'Lists', label: 'Open', keys: ['enter'] },
  listSelectAll: { area: 'Lists', label: 'Select all', keys: ['mod+a'] },
  rename: { area: 'Lists', label: 'Rename the selected file, branch, label or attribute', keys: ['f2'] },
  listDiff: { area: 'Lists', label: 'Diff the selected changeset or file', keys: ['mod+d'] },
  listCopy: { area: 'Lists', label: "Copy the selected branch's, changeset's, label's, shelve's or review's name or number", keys: ['mod+c'] },
  listContextMenu: { area: 'Lists', label: 'Actions of the selected rows', keys: ['shift+f10'] },
  listExpand: { area: 'Lists', label: 'Collapse or expand a folder', keys: ['left', 'right'] },
  rowActions: { area: 'Lists', label: 'Actions of the highlighted result (palette, pickers, Go to file)', keys: ['tab', 'shift+f10'] },

  checkin: { area: 'Changes', label: 'Check in', keys: ['mod+enter'] },
  toggleIncluded: { area: 'Changes', label: 'Include or exclude from the check in', keys: ['space'] },
  myShelves: { area: 'Changes', label: 'Your shelves', keys: ['mod+shift+s'] },
  shelvesScope: { area: 'Changes', label: "Your shelves or everyone's, in the shelves list", keys: ['mod+shift+s'] },
  review: { area: 'Changes', label: 'Mark reviewed and go to the next file', keys: ['r'] },
  nextFile: { area: 'Changes', label: 'Next file', keys: ['j'] },
  previousFile: { area: 'Changes', label: 'Previous file', keys: ['k'] },

  // F7 as in other diff tools, and while typing, where the editor moves lines with ⌥↓ ⌥↑.
  nextChange: { area: 'Diff', label: 'Next change', keys: ['alt+down', 'f7'] },
  previousChange: { area: 'Diff', label: 'Previous change', keys: ['alt+up', 'shift+f7'] },
  discardLines: { area: 'Diff', label: 'Discard the picked lines', keys: ['mod+alt+z'], keysOffMac: ['mod+shift+backspace'] },
  undoDiscard: { area: 'Diff', label: 'Undo the last discard or edit', keys: ['mod+z'] },
  clearPickedLines: { area: 'Diff', label: 'Clear the picked lines', keys: ['escape'] },
  editFile: { area: 'Diff', label: 'Type in the file', keys: ['mod+e'] },
  leaveEditor: { area: 'Diff', label: 'Leave the text for the file list (edits stay)', keys: ['escape'] },
  saveFile: { area: 'Diff', label: 'Save the edits', keys: ['mod+s'] },

  graphFind: { area: 'Branch Explorer', label: 'Find in graph', keys: ['mod+f', '/'] },
  graphNextMatch: { area: 'Branch Explorer', label: 'Next match', keys: ['enter'] },
  graphPreviousMatch: { area: 'Branch Explorer', label: 'Previous match', keys: ['shift+enter'] },
  graphClearFind: { area: 'Branch Explorer', label: 'Clear the search', keys: ['escape'] },
  graphLeaveFind: { area: 'Branch Explorer', label: 'Back to the graph from an empty search', keys: ['escape'] },
  graphWalk: { area: 'Branch Explorer', label: 'Walk the changesets', keys: ['left', 'right', 'up', 'down'] },
  graphBranchFirst: { area: 'Branch Explorer', label: 'First changeset of the branch', keys: ['home'] },
  graphBranchLast: { area: 'Branch Explorer', label: 'Last changeset of the branch', keys: ['end'] },
  graphOldest: { area: 'Branch Explorer', label: 'Oldest changeset', keys: ['mod+left', 'shift+home'] },
  graphNewest: { area: 'Branch Explorer', label: 'Newest changeset', keys: ['mod+right', 'shift+end'] },
  graphPageBack: { area: 'Branch Explorer', label: 'A screen back in time', keys: ['pageup'] },
  graphPageForward: { area: 'Branch Explorer', label: 'A screen forward in time', keys: ['pagedown'] },
  graphMergeSource: { area: 'Branch Explorer', label: 'Go to the source of a merge', keys: ['[', 'alt+left'] },
  graphMergeDestination: { area: 'Branch Explorer', label: 'Go to where it was merged', keys: [']', 'alt+right'] },
  graphBranchBase: { area: 'Branch Explorer', label: 'Go to the branch base', keys: ['p'] },
  graphOpen: { area: 'Branch Explorer', label: 'Diff the selected changeset or branch', keys: ['enter'] },
  graphOpenBranch: { area: 'Branch Explorer', label: 'Diff the branch of the selection', keys: ['shift+enter'] },
  graphMerge: { area: 'Branch Explorer', label: 'Merge from the selection', keys: ['m'] },
  graphDetails: { area: 'Branch Explorer', label: 'Show or hide the details panel', keys: ['space'] },
  graphContextMenu: { area: 'Branch Explorer', label: 'Actions of the selection', keys: ['shift+f10'] },
  graphHome: { area: 'Branch Explorer', label: 'Go to the workspace', keys: ['h'] },
  graphZoomIn: { area: 'Branch Explorer', label: 'Zoom in', keys: ['plus', '='] },
  graphZoomOut: { area: 'Branch Explorer', label: 'Zoom out', keys: ['-'] },
  graphFit: { area: 'Branch Explorer', label: 'Fit to window', keys: ['0'] },
  graphClear: { area: 'Branch Explorer', label: 'Clear the selection, then the focus', keys: ['escape'] },

  deleteFile: { area: 'Files', label: 'Delete', keys: ['mod+backspace'], keysOffMac: ['delete'] },
  newFile: { area: 'Files', label: 'New file', keys: ['mod+shift+n'] },
  newFolder: { area: 'Files', label: 'New folder', keys: ['mod+shift+d'] },
  fileHistory: { area: 'Files', label: 'History', keys: ['mod+y'], keysOffMac: ['mod+h'] },
  annotate: { area: 'Files', label: 'Diff or annotate the selected file', keys: ['mod+t'] },
  cutItems: { area: 'Files', label: 'Cut, to move into another folder', keys: ['mod+x'] },
  pasteItems: { area: 'Files', label: 'Move the cut items into the selected folder', keys: ['mod+v'] },
  cancelCut: { area: 'Files', label: 'Cancel the cut', keys: ['escape'] },
  filesGoToFile: { area: 'Files', label: 'Go to file, as the legacy client finds files', keys: ['mod+f', '/'] },
  fileViewer: { area: 'Files', label: "Into the selected file's content, or back to the tree", keys: ['f6'] },
  leaveFileViewer: { area: 'Files', label: "Back to the tree from the file's content", keys: ['escape'] },

  historyToggleView: { area: 'History', label: 'Diff or annotate the revision', keys: ['mod+shift+t'] },
  historyEnterPane: { area: 'History', label: 'Into the diff or annotation', keys: ['mod+e'] },
  historyLeavePane: { area: 'History', label: 'Back to the revisions', keys: ['escape'] },

  annotateNextBlock: { area: 'Annotate', label: 'Next block of lines', keys: ['alt+down'] },
  annotatePreviousBlock: { area: 'Annotate', label: 'Previous block of lines', keys: ['alt+up'] },
  annotateNextSameChangeset: { area: 'Annotate', label: 'Next block from the same changeset', keys: ['alt+shift+down'] },
  annotatePreviousSameChangeset: { area: 'Annotate', label: 'Previous block from the same changeset', keys: ['alt+shift+up'] },
  annotateShowRevision: { area: 'Annotate', label: "Show the block's revision", keys: ['enter'] },
  annotateBlockDetails: { area: 'Annotate', label: "The block's changeset and actions", keys: ['space'] },
  annotateLetGo: { area: 'Annotate', label: "Stop highlighting the block's changeset", keys: ['escape'] },

  merge: { area: 'Merge', label: 'Merge', keys: ['mod+enter'] },
  resolveAllInTool: { area: 'Merge', label: 'Resolve the conflicts in the merge tool, one by one', keys: ['mod+shift+enter'] },
  stopResolvingInTool: { area: 'Merge', label: 'Stop resolving one by one', keys: ['escape'] },

  paletteMove: { area: 'Command palette', label: 'Move', keys: ['up', 'down'] },
  paletteOpen: { area: 'Command palette', label: 'Open', keys: ['enter'] },
  paletteEnds: { area: 'Command palette', label: 'First or last result', keys: ['mod+up', 'mod+down', 'ctrl+home', 'ctrl+end'], keysOffMac: ['ctrl+home', 'ctrl+end'] },

  imageZoomIn: { area: 'Image diff', label: 'Zoom in', keys: ['plus', '='] },
  imageZoomOut: { area: 'Image diff', label: 'Zoom out', keys: ['-'] },
  imageFit: { area: 'Image diff', label: 'Zoom to fit', keys: ['0'] },
  imageActualSize: { area: 'Image diff', label: 'Actual size', keys: ['1'] },

  commandLogFilter: { area: 'Command log', label: 'Filter the commands, from the log', keys: ['mod+f', '/'] },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutId = keyof typeof SHORTCUTS;

/** Every key of a shortcut on macOS (`mac`) or elsewhere, the binding first; none where it doesn't exist. */
export function shortcutKeys(shortcut: ShortcutDefinition, mac: boolean): readonly string[] {
  if (mac) return shortcut.offMacOnly ? [] : shortcut.keys;
  return shortcut.keysOffMac ?? shortcut.keys;
}

/** The key that runs a shortcut. */
export function hotkey(id: ShortcutId): string {
  return hotkeys(id)[0]!;
}

/** Every key of a shortcut, the binding first. */
export function hotkeys(id: ShortcutId): readonly string[] {
  return shortcutKeys(SHORTCUTS[id], isMac);
}

/**
 * The shortcut of the view at `position` in the sidebar: ⌘1…⌘9, then ⌥⌘1, ⌥⌘2… on macOS (whose ⇧⌘3, ⇧⌘4 and ⇧⌘5
 * take screenshots before the app sees them) and Ctrl+Shift+1… elsewhere (Ctrl+Alt is AltGr, which types characters),
 * so the keys read in sidebar order and every view has one. ⌘0 is left to the View menu's Actual Size.
 */
export function viewShortcut(position: number, mac: boolean): string {
  if (position < 9) return `mod+${position + 1}`;
  return `mod+${mac ? 'alt' : 'shift'}+${position - 8}`;
}
