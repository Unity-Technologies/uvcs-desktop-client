/**
 * Every keyboard shortcut of the app, in one place: bindings read their keys from here (the renderer's `hotkey`), and the shortcuts
 * sheet lists them, including the contextual ones of views that aren't mounted. `shortcutRegistry.test.ts` fails when
 * a shortcut is written anywhere else, so the sheet can't drift from what the keys do.
 *
 * Keys are written as in the renderer's `lib/shortcuts.ts` (`mod+shift+k`); the first one is the binding, any others are alternatives.
 * `mod` is ⌘ on macOS and Ctrl elsewhere; a shortcut takes other keys on Windows and Linux (`keysOffMac`) where
 * their conventions differ (Alt+← goes back, Delete deletes, Ctrl+H is History as in their browsers since Ctrl+Y is
 * Redo) or where the Mac's would be AltGr: Ctrl+Alt types characters on most European layouts (Ctrl+Alt+Z is ż in
 * Polish), so no shortcut uses it there.
 */
export const SHORTCUT_AREAS = [
  'General',
  'Go to',
  'Lists',
  'Changes',
  'Review',
  'Diff',
  'Text',
  'Comments',
  'Branch Explorer',
  'Files',
  'History',
  'Annotate',
  'Merge',
  'Permissions',
  'Command palette',
  'Image diff',
  'Model diff',
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
  /**
   * Where it binds, when not the window: a comment field's keys (`commentField`) win inside a focused comment field,
   * and only there, so they may share a window's key (⇧⌘U formats a link there and updates the workspace elsewhere);
   * no two window keys share one (`shortcutRegistry.test.ts`, `yieldsToCommentField`).
   */
  scope?: 'commentField';
  /**
   * A person may give it other keys (Settings ▸ Keyboard, `keymapOf`): the shortcuts that run a command. Not the keys
   * every app shares (Esc, Enter, arrows, the text's own), nor the ones that act on what's under them (a list's, the
   * palette's, a comment's). Every place that reads its keys reads them again when the keymap changes
   * (docs/features/keyboard-shortcuts.md "Keys follow a change at once").
   */
  customizable?: true;
  /**
   * Why a person can't change it, for one that isn't `customizable`; every shortcut is one or the other
   * (`shortcutRegistry.test.ts`). Settings ▸ Keyboard lists it with its keys and this reason.
   * - `shared`: a key every app gives the same thing (Esc, Enter, the arrows, the clipboard, Save, Find);
   * - `text`: the text editor's own keys, a comment's included;
   * - `focus`: it moves through, or acts on, what has the keyboard focus (a list, the palette, the graph, a 3D model).
   */
  fixed?: FixedReason;
}

export type FixedReason = 'shared' | 'text' | 'focus';

export const SHORTCUTS = {
  commandPalette: { area: 'General', label: 'Command palette', keys: ['mod+k', 'mod+shift+p'], commandId: 'app.commandPalette', customizable: true },
  shortcuts: { area: 'General', label: 'Keyboard shortcuts', keys: ['?', 'mod+/'], customizable: true },
  settings: { area: 'General', label: 'Settings', keys: ['mod+,'], commandId: 'app.settings', customizable: true },
  back: { area: 'General', label: 'Back', keys: ['mod+['], keysOffMac: ['alt+left'], customizable: true },
  home: { area: 'General', label: 'Home', keys: ['mod+shift+h'], commandId: 'app.home', customizable: true },
  refresh: { area: 'General', label: 'Refresh', keys: ['mod+r'], commandId: 'workspace.refresh', customizable: true },
  updateWorkspace: { area: 'General', label: 'Update workspace', keys: ['mod+shift+u'], customizable: true },
  switchBranch: { area: 'General', label: 'Switch branch', keys: ['mod+shift+w'], commandId: 'branch.switch', customizable: true },
  newBranch: { area: 'General', label: 'New branch', keys: ['mod+b'], commandId: 'branch.new', customizable: true },
  mergeFromBranch: { area: 'General', label: 'Merge from branch', keys: ['mod+shift+m'], commandId: 'merge.fromBranch', customizable: true },
  goToFile: { area: 'Files', label: 'Go to file', keys: ['mod+p'], customizable: true },
  openWorkspace: { area: 'General', label: 'Open another workspace', keys: ['mod+shift+o'], commandId: 'workspace.open', customizable: true },
  newWindow: { area: 'General', label: 'New window', keys: ['mod+n'], commandId: 'app.newWindow', customizable: true },
  dropInNewWindow: { area: 'General', label: 'Open a folder dropped on the window in a new window (hold while dropping)', keys: ['shift'], fixed: 'shared' },
  workspaceInNewWindow: { area: 'General', label: 'Open the workspace in a new window, or Shift-click it (home screen, switcher, palette)', keys: ['shift+enter'], fixed: 'shared' },
  commandLog: { area: 'General', label: 'Command log', keys: ['mod+shift+l'], commandId: 'app.commandLog', customizable: true },
  toggleSidebar: { area: 'General', label: 'Collapse or expand the sidebar', keys: ['mod+\\'], commandId: 'app.sidebar', customizable: true },
  toggleDetails: { area: 'General', label: "Hide or show the view's details panel", keys: ['mod+i'], commandId: 'view.details', customizable: true },
  appMenu: { area: 'General', label: 'Open the menu', keys: ['f10'], offMacOnly: true, fixed: 'shared' },
  saveComment: { area: 'Comments', label: 'Save an edited comment', keys: ['mod+enter'], fixed: 'shared' },

  listFilter: { area: 'Lists', label: "Filter the view's list (/ from outside a text field)", keys: ['mod+f', '/'], fixed: 'shared' },
  listMove: { area: 'Lists', label: 'Move the selection', keys: ['up', 'down'], fixed: 'focus' },
  listExtend: { area: 'Lists', label: 'Extend the selection', keys: ['shift+up', 'shift+down'], fixed: 'focus' },
  listEnds: { area: 'Lists', label: 'First or last row', keys: ['home', 'end'], fixed: 'focus' },
  listOpen: { area: 'Lists', label: 'Open', keys: ['enter'], fixed: 'shared' },
  listSelectAll: { area: 'Lists', label: 'Select all', keys: ['mod+a'], fixed: 'shared' },
  rename: { area: 'Lists', label: 'Rename the selected file, branch, label or attribute', keys: ['f2'], customizable: true },
  listDiff: { area: 'Lists', label: 'Diff the selected changeset or file', keys: ['mod+d'], customizable: true },
  listCopy: { area: 'Lists', label: "Copy the selected branch's, changeset's, label's, shelve's or review's name or number", keys: ['mod+c'], fixed: 'shared' },
  copyLink: { area: 'General', label: 'Copy a link to the page in front, else to the selected object, else to the view', keys: ['mod+shift+c'], customizable: true },
  listContextMenu: { area: 'Lists', label: 'Actions of the selected rows', keys: ['shift+f10'], fixed: 'shared' },
  listExpand: { area: 'Lists', label: 'Collapse or expand a folder', keys: ['left', 'right'], fixed: 'focus' },
  rowActions: { area: 'Lists', label: 'Actions of the highlighted result (palette, switchers, Go to file)', keys: ['tab', 'shift+f10'], fixed: 'shared' },
  // Any list of files a review can mark (Changes, a diff's, a code review's): `isReviewKey`.
  review: { area: 'Review', label: 'Mark reviewed and go to the next file', keys: ['r'], customizable: true },

  checkin: { area: 'Changes', label: 'Check in', keys: ['mod+enter'], customizable: true },
  toggleIncluded: { area: 'Changes', label: 'Include or exclude from the check in', keys: ['space'], fixed: 'shared' },
  myShelves: { area: 'Changes', label: 'Your shelves', keys: ['mod+shift+s'], customizable: true },
  shelvesScope: { area: 'Changes', label: "Your shelves or everyone's, in the shelves list", keys: ['mod+shift+s'], customizable: true },
  nextFile: { area: 'Changes', label: 'Next file', keys: ['j'], fixed: 'focus' },
  previousFile: { area: 'Changes', label: 'Previous file', keys: ['k'], fixed: 'focus' },

  // F7 as in other diff tools, and while typing, where the editor moves lines with ⌥↓ ⌥↑.
  nextChange: { area: 'Diff', label: 'Next change', keys: ['alt+down', 'f7'], customizable: true },
  previousChange: { area: 'Diff', label: 'Previous change', keys: ['alt+up', 'shift+f7'], customizable: true },
  // As Annotate steps through a changeset's blocks; ⌥↓ ⌥↑ are the changes'.
  nextChangeset: { area: 'Diff', label: 'Next changeset of the branch', keys: ['alt+shift+down'], customizable: true },
  previousChangeset: { area: 'Diff', label: 'Previous changeset of the branch', keys: ['alt+shift+up'], customizable: true },
  // In a review's Changes, in the order its Comments panel lists them, across files; N as in "next", where nothing takes it.
  nextComment: { area: 'Review', label: "Next comment on a review's code", keys: ['n'], customizable: true },
  previousComment: { area: 'Review', label: "Previous comment on a review's code", keys: ['shift+n'], customizable: true },
  discardLines: { area: 'Diff', label: 'Discard the picked lines', keys: ['mod+alt+z'], keysOffMac: ['mod+shift+backspace'], customizable: true },
  undoDiscard: { area: 'Diff', label: 'Undo the last discard or edit', keys: ['mod+z'], fixed: 'shared' },
  clearPickedLines: { area: 'Diff', label: 'Clear the picked lines', keys: ['escape'], fixed: 'shared' },
  editFile: { area: 'Diff', label: 'Type in the file', keys: ['mod+e'], customizable: true },
  leaveEditor: { area: 'Diff', label: 'Leave the text for the file list (edits stay)', keys: ['escape'], fixed: 'shared' },
  saveFile: { area: 'Diff', label: 'Save the edits', keys: ['mod+s'], fixed: 'shared' },
  // E for Expand, on every OS: no browser, desktop or the diff's editor takes it, and it stays clear of the window's
  // own full screen (⌃⌘F, F11), which is another thing. Esc leaves once nothing else takes it (`escapeCollapsesDiff`).
  expandDiff: { area: 'Diff', label: 'Expand the diff to the whole window, or collapse it', keys: ['mod+shift+e'], commandId: 'view.expandDiff', customizable: true },
  collapseDiff: { area: 'Diff', label: 'Collapse the expanded diff', keys: ['escape'], fixed: 'shared' },

  // The text of a diff or a merge, as its editor (Pierre's) takes the keys; its right-click menu shows them (`codeMenu`).
  // Replace is ⌥⌘F on macOS; off macOS, where Ctrl+Alt is AltGr, it's Ctrl+H, as other editors there have it
  // (`pierreEditorKeymap`; AltGr typing a character still types it: `searchKeyMode`). ⌘H would hide the app on macOS.
  textUndo: { area: 'Text', label: 'Undo', keys: ['mod+z'], fixed: 'text' },
  textRedo: { area: 'Text', label: 'Redo', keys: ['mod+shift+z'], keysOffMac: ['mod+y'], fixed: 'text' },
  textCut: { area: 'Text', label: 'Cut', keys: ['mod+x'], fixed: 'text' },
  textCopy: { area: 'Text', label: 'Copy', keys: ['mod+c'], fixed: 'text' },
  textPaste: { area: 'Text', label: 'Paste', keys: ['mod+v'], fixed: 'text' },
  textSelectAll: { area: 'Text', label: 'Select all', keys: ['mod+a'], fixed: 'text' },
  // Find is the app's own search on every side of a diff (`CodeFindBar`). Its next and previous match are Enter and
  // Shift+Enter in its field, and ⌘G and ⇧⌘G from anywhere in the code on macOS, F3 and Shift+F3 elsewhere, where
  // Ctrl+G is Go to line.
  textFind: { area: 'Text', label: 'Find in the code', keys: ['mod+f'], fixed: 'text' },
  textFindNext: { area: 'Text', label: 'Next match (Enter in the search box)', keys: ['enter', 'mod+g'], keysOffMac: ['enter', 'f3'], fixed: 'text' },
  textFindPrevious: { area: 'Text', label: 'Previous match (Shift+Enter in the search box)', keys: ['shift+enter', 'mod+shift+g'], keysOffMac: ['shift+enter', 'shift+f3'], fixed: 'text' },
  textCloseFind: { area: 'Text', label: 'Close the search box', keys: ['escape'], fixed: 'text' },
  textReplace: { area: 'Text', label: 'Find and replace in the text being typed', keys: ['mod+alt+f'], keysOffMac: ['mod+h'], fixed: 'text' },
  // ⌃G on macOS, as in other editors there: ⌘G is Find next.
  goToLine: { area: 'Text', label: 'Go to line', keys: ['ctrl+g'], keysOffMac: ['mod+g'], fixed: 'text' },

  // A comment being written (`components/commentEditor`): Slack's keys, which take the comment's own text before the
  // window's inside a focused comment field (`scope`): ⌘B, ⇧⌘U and ⇧⌘C do something else outside one. ⌘K stays the
  // command palette's, as everywhere. Off macOS the code block takes Ctrl+Shift+E, as Ctrl+Alt is AltGr there.
  commentBold: { area: 'Comments', label: 'Bold', keys: ['mod+b'], scope: 'commentField', fixed: 'text' },
  commentItalic: { area: 'Comments', label: 'Italic', keys: ['mod+i'], scope: 'commentField', fixed: 'text' },
  commentStrikethrough: { area: 'Comments', label: 'Strikethrough', keys: ['mod+shift+x'], scope: 'commentField', fixed: 'text' },
  commentCode: { area: 'Comments', label: 'Code', keys: ['mod+shift+c'], scope: 'commentField', fixed: 'text' },
  commentLink: { area: 'Comments', label: 'Link', keys: ['mod+shift+u'], scope: 'commentField', fixed: 'text' },
  commentList: { area: 'Comments', label: 'List', keys: ['mod+shift+8'], scope: 'commentField', fixed: 'text' },
  commentNumberedList: { area: 'Comments', label: 'Numbered list', keys: ['mod+shift+7'], scope: 'commentField', fixed: 'text' },
  commentQuote: { area: 'Comments', label: 'Quote', keys: ['mod+shift+9'], scope: 'commentField', fixed: 'text' },
  commentCodeBlock: { area: 'Comments', label: 'Code block', keys: ['mod+alt+shift+c'], keysOffMac: ['mod+shift+e'], scope: 'commentField', fixed: 'text' },
  commentPastePlain: { area: 'Comments', label: 'Paste without formatting', keys: ['mod+shift+v'], scope: 'commentField', fixed: 'text' },
  commentFocusMode: { area: 'Comments', label: 'Write in a larger editor, and back', keys: ['mod+shift+f'], scope: 'commentField', fixed: 'text' },

  graphFind: { area: 'Branch Explorer', label: 'Find in graph', keys: ['mod+f', '/'], fixed: 'shared' },
  graphNextMatch: { area: 'Branch Explorer', label: 'Next match (Enter in the search box)', keys: ['enter'], fixed: 'shared' },
  graphPreviousMatch: { area: 'Branch Explorer', label: 'Previous match (Shift+Enter in the search box)', keys: ['shift+enter'], fixed: 'shared' },
  graphClearFind: { area: 'Branch Explorer', label: 'Clear the search', keys: ['escape'], fixed: 'shared' },
  graphLeaveFind: { area: 'Branch Explorer', label: 'Back to the graph from an empty search', keys: ['escape'], fixed: 'shared' },
  graphWalk: { area: 'Branch Explorer', label: 'Walk the changesets', keys: ['left', 'right', 'up', 'down'], fixed: 'focus' },
  graphBranchFirst: { area: 'Branch Explorer', label: 'First changeset of the branch', keys: ['home'], fixed: 'focus' },
  graphBranchLast: { area: 'Branch Explorer', label: 'Last changeset of the branch, or its pending changes', keys: ['end'], fixed: 'focus' },
  graphOldest: { area: 'Branch Explorer', label: 'Oldest changeset', keys: ['mod+left', 'shift+home'], fixed: 'focus' },
  graphNewest: { area: 'Branch Explorer', label: 'Newest changeset', keys: ['mod+right', 'shift+end'], fixed: 'focus' },
  graphPageBack: { area: 'Branch Explorer', label: 'A screen back in time', keys: ['pageup'], fixed: 'focus' },
  graphPageForward: { area: 'Branch Explorer', label: 'A screen forward in time', keys: ['pagedown'], fixed: 'focus' },
  graphMergeSource: { area: 'Branch Explorer', label: 'Go to the source of a merge', keys: ['[', 'alt+left'], customizable: true },
  graphMergeDestination: { area: 'Branch Explorer', label: 'Go to where it was merged', keys: [']', 'alt+right'], customizable: true },
  graphBranchBase: { area: 'Branch Explorer', label: 'Go to the branch base', keys: ['p'], customizable: true },
  graphOpen: { area: 'Branch Explorer', label: 'Diff the selected changeset or branch', keys: ['enter'], fixed: 'shared' },
  graphOpenBranch: { area: 'Branch Explorer', label: 'Diff the branch of the selection', keys: ['shift+enter'], customizable: true },
  graphMerge: { area: 'Branch Explorer', label: 'Merge from the selection', keys: ['m'], customizable: true },
  graphDetails: { area: 'Branch Explorer', label: 'Hide or show the details panel', keys: ['space'], fixed: 'shared' },
  graphContextMenu: { area: 'Branch Explorer', label: 'Actions of the selection', keys: ['shift+f10'], fixed: 'shared' },
  graphMoveBranchUp: { area: 'Branch Explorer', label: 'Move the branch up', keys: ['mod+up'], customizable: true },
  graphMoveBranchDown: { area: 'Branch Explorer', label: 'Move the branch down', keys: ['mod+down'], customizable: true },
  graphMoveBranchToTop: { area: 'Branch Explorer', label: 'Move the branch to the top', keys: ['mod+shift+up'], customizable: true },
  graphMoveBranchToBottom: { area: 'Branch Explorer', label: 'Move the branch to the bottom', keys: ['mod+shift+down'], customizable: true },
  graphHome: { area: 'Branch Explorer', label: 'Go to the workspace', keys: ['h'], customizable: true },
  graphZoomIn: { area: 'Branch Explorer', label: 'Zoom in', keys: ['plus', '='], customizable: true },
  graphZoomOut: { area: 'Branch Explorer', label: 'Zoom out', keys: ['-'], customizable: true },
  graphFit: { area: 'Branch Explorer', label: 'Fit to window', keys: ['0'], customizable: true },
  // Off macOS Alt+Shift, as Ctrl+Alt is AltGr there. From another view it opens the Branch Explorer with it shown.
  graphTimeline: { area: 'General', label: 'Show or hide the timeline', keys: ['mod+alt+t'], keysOffMac: ['alt+shift+t'], commandId: 'branchExplorer.timeline', customizable: true },
  graphClear: { area: 'Branch Explorer', label: 'Clear the selection, then the focus', keys: ['escape'], fixed: 'shared' },

  deleteFile: { area: 'Files', label: 'Delete', keys: ['mod+backspace'], keysOffMac: ['delete'], customizable: true },
  newFile: { area: 'Files', label: 'New file', keys: ['mod+shift+n'], customizable: true },
  newFolder: { area: 'Files', label: 'New folder', keys: ['mod+shift+d'], customizable: true },
  fileHistory: { area: 'Files', label: 'History', keys: ['mod+y'], keysOffMac: ['mod+h'], customizable: true },
  annotate: { area: 'Files', label: 'Diff or annotate the selected file', keys: ['mod+t'], customizable: true },
  cutItems: { area: 'Files', label: 'Cut, to move into another folder', keys: ['mod+x'], fixed: 'shared' },
  pasteItems: { area: 'Files', label: 'Move the cut items into the selected folder', keys: ['mod+v'], fixed: 'shared' },
  cancelCut: { area: 'Files', label: 'Cancel the cut', keys: ['escape'], fixed: 'shared' },
  filesGoToFile: { area: 'Files', label: 'Go to file, as the legacy client finds files', keys: ['mod+f', '/'], fixed: 'shared' },
  fileViewer: { area: 'Files', label: "Into the selected file's content, or back to the tree", keys: ['f6'], customizable: true },
  leaveFileViewer: { area: 'Files', label: "Back to the tree from the file's content", keys: ['escape'], fixed: 'shared' },

  historyToggleView: { area: 'History', label: 'Diff or annotate the revision', keys: ['mod+shift+t'], customizable: true },
  historyEnterPane: { area: 'History', label: 'Into the diff or annotation', keys: ['mod+e'], customizable: true },
  historyLeavePane: { area: 'History', label: 'Back to the revisions', keys: ['escape'], fixed: 'shared' },

  annotateNextBlock: { area: 'Annotate', label: 'Next block of lines', keys: ['alt+down'], customizable: true },
  annotatePreviousBlock: { area: 'Annotate', label: 'Previous block of lines', keys: ['alt+up'], customizable: true },
  annotateNextSameChangeset: { area: 'Annotate', label: 'Next block from the same changeset', keys: ['alt+shift+down'], customizable: true },
  annotatePreviousSameChangeset: { area: 'Annotate', label: 'Previous block from the same changeset', keys: ['alt+shift+up'], customizable: true },
  annotateShowRevision: { area: 'Annotate', label: "Show the block's revision", keys: ['enter'], fixed: 'shared' },
  annotateBlockDetails: { area: 'Annotate', label: "The block's changeset and actions", keys: ['space'], fixed: 'shared' },
  annotateLetGo: { area: 'Annotate', label: "Stop highlighting the block's changeset", keys: ['escape'], fixed: 'shared' },

  merge: { area: 'Merge', label: 'Merge', keys: ['mod+enter'], customizable: true },
  // The diff's keys: a conflict is to the merge page what a change is to a diff.
  nextConflict: { area: 'Merge', label: 'Next conflict', keys: ['alt+down', 'f7'], customizable: true },
  previousConflict: { area: 'Merge', label: 'Previous conflict', keys: ['alt+up', 'shift+f7'], customizable: true },
  resolveAllInTool: { area: 'Merge', label: 'Resolve the conflicts in the merge tool, one by one', keys: ['mod+shift+enter'], customizable: true },
  stopResolvingInTool: { area: 'Merge', label: 'Stop resolving one by one', keys: ['escape'], fixed: 'shared' },

  permissionAllow: { area: 'Permissions', label: 'Allow the permission', keys: ['a'], fixed: 'focus' },
  permissionDeny: { area: 'Permissions', label: 'Deny the permission', keys: ['d'], fixed: 'focus' },
  permissionInherit: { area: 'Permissions', label: 'Inherit the permission from above', keys: ['i'], fixed: 'focus' },
  permissionStep: { area: 'Permissions', label: 'Inherit, allow or deny the permission', keys: ['left', 'right'], fixed: 'focus' },
  permissionMenu: { area: 'Permissions', label: 'Ignore what the lists above say', keys: ['shift+f10'], fixed: 'shared' },
  removeMember: { area: 'Permissions', label: 'Remove the selected user or group', keys: ['mod+backspace'], keysOffMac: ['delete'], fixed: 'shared' },
  savePermissions: { area: 'Permissions', label: 'Save the changes', keys: ['mod+enter'], fixed: 'shared' },

  paletteMove: { area: 'Command palette', label: 'Move', keys: ['up', 'down'], fixed: 'focus' },
  paletteOpen: { area: 'Command palette', label: 'Open', keys: ['enter'], fixed: 'shared' },
  paletteEnds: { area: 'Command palette', label: 'First or last result', keys: ['mod+up', 'mod+down', 'ctrl+home', 'ctrl+end'], keysOffMac: ['ctrl+home', 'ctrl+end'], fixed: 'focus' },
  // A browser's previous and next tab, by arrows any keyboard layout has. Not ⌘ or ⌥ alone (the caret, in the search),
  // nor ⌃ (macOS switches desktops), nor Ctrl+Alt off Mac (AltGr); Alt+← is Back there, the palette's while it's open.
  paletteScope: { area: 'Command palette', label: 'Previous or next scope', keys: ['mod+alt+left', 'mod+alt+right'], keysOffMac: ['alt+left', 'alt+right'], fixed: 'focus' },

  imageZoomIn: { area: 'Image diff', label: 'Zoom in', keys: ['plus', '='], customizable: true },
  imageZoomOut: { area: 'Image diff', label: 'Zoom out', keys: ['-'], customizable: true },
  imageFit: { area: 'Image diff', label: 'Zoom to fit', keys: ['0'], customizable: true },
  imageActualSize: { area: 'Image diff', label: 'Actual size', keys: ['1'], customizable: true },
  imageComment: { area: 'Image diff', label: 'Comment on a point or an area', keys: ['c'], customizable: true },
  imageCommentLeave: { area: 'Image diff', label: 'Stop commenting, or close the comment open', keys: ['escape'], fixed: 'shared' },

  modelFrame: { area: 'Model diff', label: 'Frame the part picked, or the whole model', keys: ['f'], customizable: true },
  modelFrameAll: { area: 'Model diff', label: 'Frame the whole model', keys: ['0'], customizable: true },
  modelComment: { area: 'Model diff', label: 'Comment on a point, or Shift-click for the whole part', keys: ['c'], customizable: true },
  modelCommentLeave: { area: 'Model diff', label: 'Stop commenting, or close the comment open', keys: ['escape'], fixed: 'shared' },
  modelFlyForward: { area: 'Model diff', label: 'Move forward (Shift: faster)', keys: ['w', 'up'], fixed: 'focus' },
  modelFlyBack: { area: 'Model diff', label: 'Move back (Shift: faster)', keys: ['s', 'down'], fixed: 'focus' },
  modelFlyLeft: { area: 'Model diff', label: 'Move left (Shift: faster)', keys: ['a', 'left'], fixed: 'focus' },
  modelFlyRight: { area: 'Model diff', label: 'Move right (Shift: faster)', keys: ['d', 'right'], fixed: 'focus' },
  modelFlyUp: { area: 'Model diff', label: 'Move up (Shift: faster)', keys: ['e'], fixed: 'focus' },
  modelFlyDown: { area: 'Model diff', label: 'Move down (Shift: faster)', keys: ['q'], fixed: 'focus' },

  commandLogFilter: { area: 'Command log', label: 'Filter the commands, from the log', keys: ['mod+f', '/'], fixed: 'shared' },
} as const satisfies Record<string, ShortcutDefinition>;

export type ShortcutId = keyof typeof SHORTCUTS;

/** The shortcuts a person may give other keys, or none (`customizable`). */
export type CustomizableShortcutId = { [Id in ShortcutId]: (typeof SHORTCUTS)[Id] extends { customizable: true } ? Id : never }[ShortcutId];

/** Every key of a shortcut on macOS (`mac`) or elsewhere, the binding first; none where it doesn't exist. */
export function shortcutKeys(shortcut: ShortcutDefinition, mac: boolean): readonly string[] {
  if (mac) return shortcut.offMacOnly ? [] : shortcut.keys;
  return shortcut.keysOffMac ?? shortcut.keys;
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
