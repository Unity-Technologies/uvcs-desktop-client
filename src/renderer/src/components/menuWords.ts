import {
  AppWindow,
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  ArrowUpFromLine,
  Binary,
  Cherry,
  CircleCheck,
  CircleDot,
  ClipboardPaste,
  CodeXml,
  Copy,
  CornerLeftUp,
  Delete,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck,
  FileClock,
  FileDiff,
  FileDown,
  FilePlus,
  Files,
  Filter,
  FolderGit2,
  FolderInput,
  FolderLock,
  FolderOpen,
  FolderPen,
  FolderPlus,
  FolderSearch,
  FolderSymlink,
  FolderTree,
  GitBranchPlus,
  GitCommitHorizontal,
  GitCommitVertical,
  GitCompareArrows,
  GitGraph,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  Hash,
  History,
  Layers,
  Link,
  Lock,
  LockOpen,
  Merge,
  MessageSquareCode,
  MessageSquareText,
  Minus,
  MoveRight,
  Pencil,
  PenLine,
  PictureInPicture2,
  Plus,
  Redo2,
  Replace,
  RotateCcw,
  ScanText,
  Scissors,
  Search,
  ServerCog,
  ShieldCheck,
  Square,
  SquareArrowOutUpRight,
  SquareCheckBig,
  SquareTerminal,
  Tag,
  Telescope,
  Text,
  TextSelect,
  Trash2,
  Undo2,
  UserPlus,
  X,
} from 'lucide-react';
import type { Action, Icon, MenuEntry, Submenu } from '../lib/actions';
import type { GroupedEntry, MenuGroup } from '../lib/menuGroups';
import { OPEN_IN_FILE_MANAGER_LABEL, REVEAL_LABEL } from '../lib/platform';
import { MERGE_INTO_WORKSPACE, serverMergeLabel } from './mergeMenuLabels';

/** A concept of the menus: the group it goes in, its icon, and its words where they are the same for every object. */
export interface MenuWord {
  group: MenuGroup;
  icon: Icon;
  /** Omitted where the words name the object or a count ("Switch to this branch", "Delete 3 labels…"). */
  label?: string;
  danger?: true;
}

const word = (group: MenuGroup, icon: Icon, label?: string, danger?: true): MenuWord => ({ group, icon, label, danger });

/**
 * The vocabulary of every object's menu (docs/ARCHITECTURE.md, Menus): one concept, one id, one icon, one wording and
 * one place, whatever the object and wherever its menu shows. Entries made from it (`menuAction`, `menuSubmenu`) carry
 * their group, so `groupedMenu` puts them in the grammar's order.
 */
export const MENU_WORDS = {
  // What Enter or a double-click does in the app.
  diff: word('primary', FileDiff, 'Open diff'),
  diffRange: word('primary', FileDiff),
  diffPair: word('primary', GitCompareArrows, 'Compare selected labels'),
  diffMerge: word('primary', FileDiff, 'Open diff of the merge'),
  changesetDiff: word('primary', FileDiff),
  openReview: word('primary', ExternalLink, 'Open review'),
  // The same, in a window of its own (`openInNewWindow`), to read beside the workspace's window, on another display.
  diffInNewWindow: word('primary', PictureInPicture2, 'Open diff in new window'),
  reviewInNewWindow: word('primary', PictureInPicture2, 'Open review in new window'),
  release: word('primary', LockOpen, 'Release lock'),
  openWorkspace: word('primary', FolderOpen, 'Open workspace'),
  openInNewWindow: word('primary', AppWindow, 'Open in new window'),
  // A repository, without a workspace (`exploreRepository`).
  explore: word('primary', Telescope, 'Explore'),
  exploreInNewWindow: word('primary', AppWindow, 'Explore in new window'),
  locate: word('primary', FolderSearch, 'Locate or recreate…'),

  // Opening it in other apps, and the file manager (`openOnDiskEntries`, `openRevisionEntries`): a file's Enter too.
  // The words name the app ("Open in Visual Studio Code").
  open: word('open', AppWindow),
  openInEditor: word('open', CodeXml),
  terminal: word('open', SquareTerminal),
  openRevision: word('open', AppWindow),
  openWith: word('open', SquareArrowOutUpRight, 'Open with'),
  openRevisionWith: word('open', SquareArrowOutUpRight, 'Open this revision with'),
  // A merge's file as each side has it, or the base: the entries name the sides ("Yours", "Incoming", "Base").
  openVersion: word('open', Layers, 'Open version'),
  reveal: word('open', FolderSearch, REVEAL_LABEL),
  openInFileManager: word('open', FolderSearch, OPEN_IN_FILE_MANAGER_LABEL),

  // What it does to the workspace or to the object.
  // Text typed into (`codeMenu`): its edits undone and redone, as the editor's keys do.
  undoEdit: word('act', Undo2, 'Undo'),
  redoEdit: word('act', Redo2, 'Redo'),
  switch: word('act', ArrowRightLeft),
  taskWorkspace: word('act', FolderGit2, 'Work on this branch in a new workspace…'),
  revert: word('act', RotateCcw),
  apply: word('act', ArchiveRestore),
  applyAndDelete: word('act', ArchiveRestore, 'Apply and delete'),
  // The changes it holds checked in or shelved; the words name the object ("Check in this changelist"). The icons are
  // the check-in panel's for each mode (`describeMode`).
  checkin: word('act', GitCommitHorizontal),
  shelve: word('act', Archive),
  include: word('act', SquareCheckBig, 'Include in check-in'),
  exclude: word('act', Square, 'Exclude from check-in'),
  review: word('act', CircleCheck),
  // A conflicting file of a merge or an update settled by taking one version whole; the words name the side ("Keep yours").
  keepDestination: word('act', FileCheck),
  keepSource: word('act', FileDown),
  // A conflicting file settled by keeping its common ancestor's version whole ("Keep base", "for 3 files").
  keepBase: word('act', FileClock),
  // A directory conflict settled by keeping both items, yours under a new name.
  keepBoth: word('act', Files, 'Keep both'),
  // A conflicting file opened in a merge tool; the words name the tool ("Resolve in Visual Studio Code").
  resolveIn: word('act', Merge),
  // The same, in any other tool, this once: the entries name the tools.
  resolveWith: word('act', Merge, 'Resolve with'),
  // A conflicting file back to how the merge started it, the user's decision dropped.
  startOver: word('act', RotateCcw, 'Start over'),
  // A deleted item brought back as a pending change; the words name it ("Restore file", "Restore 3 items").
  restore: word('act', ArchiveRestore),
  restoreTo: word('act', FolderInput, 'Restore to…'),
  add: word('act', Plus),
  checkout: word('act', PenLine, 'Check out'),
  status: word('act', CircleDot, 'Set status'),
  assign: word('act', UserPlus, 'Assign reviewer…'),
  // Sync: the words name the other repository ("Push to game@cloud").
  push: word('act', ArrowUpFromLine),
  pull: word('act', ArrowDownToLine),

  // Merging it somewhere.
  merge: word('merge', GitMerge, MERGE_INTO_WORKSPACE),
  mergeTask: word('merge', GitPullRequest),
  mergeTo: word('merge', GitPullRequestArrow, serverMergeLabel()),
  cherryPick: word('merge', Cherry),
  subtractive: word('merge', Minus, 'Subtractive merge (remove its changes)'),
  cherryPickRange: word('merge', Cherry),
  subtractiveRange: word('merge', Minus),

  // New things from it.
  newBranch: word('create', GitBranchPlus, 'New branch from here…'),
  newLabel: word('create', Tag, 'New label…'),
  newCodeReview: word('create', MessageSquareCode, 'New code review…'),
  newFile: word('create', FilePlus, 'New file…'),
  newFolder: word('create', FolderPlus, 'New folder…'),
  // A folder showing another repository (docs/features/xlinks.md).
  newXlink: word('create', FolderSymlink, 'New xlink…'),
  newWorkspace: word('create', FolderPlus, 'New workspace…'),
  newTaskWorkspace: word('create', FolderGit2, 'New workspace for a task…'),
  newWindow: word('create', AppWindow, 'New window'),

  // Other views of it.
  changes: word('navigate', FileDiff, 'Show changes'),
  history: word('navigate', History, 'View history'),
  annotate: word('navigate', ScanText, 'Annotate'),
  annotateRevision: word('navigate', ScanText, 'Annotate this revision'),
  // Lines of code (`lineMenu`): who last changed them, as the diff's newer side has them.
  annotateLine: word('navigate', ScanText),
  // The words name the kind of object picked ("Compare with another branch…").
  compare: word('navigate', GitCompareArrows),
  browse: word('navigate', FolderTree),
  changesets: word('navigate', GitCommitVertical, 'Show changesets'),
  showInBranchExplorer: word('navigate', GitGraph, 'Show in Branch Explorer'),
  locks: word('navigate', Lock, 'Show locks'),
  showInLocks: word('navigate', Lock, 'Show in Locks'),
  showInFiles: word('navigate', FolderTree, 'Show in Files'),
  // Text (`codeMenu`): finding in it, a line of it, and what's selected compared with the clipboard.
  find: word('navigate', Search, 'Find'),
  replace: word('navigate', Replace, 'Replace'),
  goToLine: word('navigate', Hash, 'Go to line…'),
  compareWithClipboard: word('navigate', GitCompareArrows, 'Compare with clipboard'),
  // The Branch Explorer's own ways around the graph.
  parent: word('navigate', CornerLeftUp, 'Go to parent changeset'),
  head: word('navigate', ArrowRightToLine, 'Go to head changeset'),
  base: word('navigate', ArrowLeftToLine, 'Go to branch base'),
  related: word('navigate', Filter, 'Show only related branches'),
  labeledChangeset: word('navigate', GitCommitVertical, 'Go to labeled changeset'),
  source: word('navigate', ArrowLeftToLine, 'Go to source changeset'),
  destination: word('navigate', ArrowRightToLine, 'Go to destination changeset'),

  // The OS.
  saveAs: word('external', Download, 'Save this revision as…'),

  // The clipboard: Cut, Copy, Paste, as everywhere.
  cut: word('clipboard', Scissors, 'Cut'),
  copy: word('clipboard', Copy, 'Copy'),
  // Lines of code (`lineMenu`): a link to them ("Copy link to lines 40–52"), and their text.
  copyLineLink: word('clipboard', Link),
  copyLines: word('clipboard', Copy),
  paste: word('clipboard', ClipboardPaste, 'Paste'),
  // Text selected (`codeMenu`), not an object: what it holds, not its names.
  copyText: word('clipboard', Copy, 'Copy'),

  // What it's called, says or is filed under.
  // Text (`codeMenu`): what's selected removed, without the clipboard; everything selected.
  deleteText: word('edit', Delete, 'Delete'),
  selectAll: word('edit', TextSelect, 'Select all'),
  rename: word('edit', Pencil, 'Rename…'),
  editComment: word('edit', MessageSquareText, 'Edit comment…'),
  describe: word('edit', Text, 'Edit description…'),
  move: word('edit', MoveRight, 'Move to another branch…'),
  changelist: word('edit', FolderInput, 'Move to changelist'),
  filterRules: word('edit', EyeOff, 'Ignore, cloak or hide'),
  revisionType: word('edit', Binary, 'Revision type'),
  editXlink: word('edit', FolderPen, 'Edit xlink…'),
  hide: word('edit', EyeOff),
  unhide: word('edit', Eye),
  forget: word('edit', X, 'Remove from list'),
  // Who may do what with it (docs/features/permissions.md).
  permissions: word('edit', ShieldCheck, 'Permissions…'),
  pathPermissions: word('edit', FolderLock, 'Path permissions…'),
  serverPermissions: word('edit', ServerCog, 'Server permissions…'),

  // What undoes or deletes it.
  undo: word('danger', Undo2, undefined, true),
  trash: word('danger', Trash2, undefined, true),
  remove: word('danger', X, undefined, true),
  delete: word('danger', Trash2, 'Delete…', true),
} satisfies Record<string, MenuWord>;

export type MenuWordId = keyof typeof MENU_WORDS;

/**
 * The words whose action needs a workspace, so a repository explored without one never offers them
 * (ARCHITECTURE.md "Places"): they change the files on disk or what the workspace is on (switch, merge into
 * it, cherry pick, apply, revert, check in, shelve, resolve a conflict), or read and open them there (the editor, the
 * terminal, the file manager). The server's merges ("Merge to…", finishing a task) are here too: the merge page runs
 * in a workspace. `rename` or `delete` aren't: they serve branches and labels as well as files, and the menus of files
 * take a workspace's path, which a repository's window has none of. `menuGrammar.test.ts` builds every object's menu
 * for a repository and checks none of these is there.
 */
export const NEEDS_A_WORKSPACE = [
  'switch',
  'revert',
  'apply',
  'applyAndDelete',
  'checkin',
  'shelve',
  'include',
  'exclude',
  'keepDestination',
  'keepSource',
  'keepBase',
  'keepBoth',
  'resolveIn',
  'startOver',
  'restore',
  'restoreTo',
  'add',
  'checkout',
  'merge',
  'mergeTask',
  'mergeTo',
  'cherryPick',
  'subtractive',
  'cherryPickRange',
  'subtractiveRange',
  'newFile',
  'newFolder',
  'newXlink',
  'openInEditor',
  'terminal',
  'reveal',
  'openInFileManager',
  'cut',
  'paste',
  'changelist',
  'filterRules',
  'revisionType',
  'editXlink',
] as const satisfies readonly MenuWordId[];

type ActionOptions = Partial<Pick<Action, 'label' | 'shortcut' | 'detail' | 'disabled' | 'disabledReason'>>;

/** An entry of the vocabulary: its words (or `label`, where they name the object), icon and group. */
export function menuAction(id: MenuWordId, run: () => void, options: ActionOptions = {}): GroupedEntry & Action {
  const { group, icon, label, danger } = MENU_WORDS[id] as MenuWord;
  return { id, label: options.label ?? label ?? id, icon, menuGroup: group, ...(danger && { danger }), ...options, run };
}

/** A submenu of the vocabulary: a real set of choices, e.g. the review statuses or what to copy. */
export function menuSubmenu(id: MenuWordId, entries: MenuEntry[]): GroupedEntry & Submenu {
  const { group, icon, label } = MENU_WORDS[id] as MenuWord;
  return { id, label: label ?? id, icon, menuGroup: group, entries };
}

/** Where an object's menu shows (its host), when that changes it; what a host adds goes through `withEntries`. */
export interface MenuHost {
  /** The Branch Explorer, where "Show in Branch Explorer" would lead where the user already is. */
  inBranchExplorer?: boolean;
  /**
   * A list that binds none of the list keys (⌘D, ⌘C, ⇧⌘C), so the menu names no shortcut: there they reach the page's
   * own object or the view under the page (docs/ARCHITECTURE.md "Menus").
   */
  listKeysElsewhere?: boolean;
  /** Called with the name of a branch created from the menu, e.g. to show it. */
  onBranchCreated?: (name: string) => void;
}
