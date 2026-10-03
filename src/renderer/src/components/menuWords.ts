import {
  AppWindow,
  ArchiveRestore,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightLeft,
  ArrowRightToLine,
  ArrowUpFromLine,
  Binary,
  Cherry,
  ClipboardPaste,
  CircleCheck,
  CircleDot,
  CodeXml,
  Copy,
  CornerLeftUp,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileDiff,
  FilePlus,
  Filter,
  FolderGit2,
  FolderInput,
  FolderLock,
  FolderOpen,
  FolderPlus,
  FolderSearch,
  FolderTree,
  GitBranchPlus,
  GitCommitVertical,
  GitCompareArrows,
  GitGraph,
  GitMerge,
  GitPullRequest,
  GitPullRequestArrow,
  History,
  Lock,
  LockOpen,
  MessageSquareCode,
  MessageSquareText,
  Minus,
  MoveRight,
  PenLine,
  Pencil,
  Plus,
  RotateCcw,
  ScanText,
  Scissors,
  ServerCog,
  ShieldCheck,
  Square,
  SquareArrowOutUpRight,
  SquareCheckBig,
  SquareTerminal,
  Tag,
  Text,
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
  release: word('primary', LockOpen, 'Release lock'),
  openWorkspace: word('primary', FolderOpen, 'Open workspace'),
  locate: word('primary', FolderSearch, 'Locate or recreate…'),

  // Opening it in other apps, and the file manager (`openOnDiskEntries`, `openRevisionEntries`): a file's Enter too.
  // The words name the app ("Open in Visual Studio Code").
  open: word('open', AppWindow),
  openInEditor: word('open', CodeXml),
  terminal: word('open', SquareTerminal),
  openRevision: word('open', AppWindow),
  openWith: word('open', SquareArrowOutUpRight, 'Open with'),
  openRevisionWith: word('open', SquareArrowOutUpRight, 'Open this revision with'),
  reveal: word('open', FolderSearch, REVEAL_LABEL),
  openInFileManager: word('open', FolderSearch, OPEN_IN_FILE_MANAGER_LABEL),

  // What it does to the workspace or to the object.
  switch: word('act', ArrowRightLeft),
  taskWorkspace: word('act', FolderGit2, 'Work on this branch in a new workspace…'),
  revert: word('act', RotateCcw),
  apply: word('act', ArchiveRestore),
  applyAndDelete: word('act', ArchiveRestore, 'Apply and delete'),
  include: word('act', SquareCheckBig, 'Include in check-in'),
  exclude: word('act', Square, 'Exclude from check-in'),
  review: word('act', CircleCheck),
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
  newWorkspace: word('create', FolderPlus, 'New workspace…'),
  newTaskWorkspace: word('create', FolderGit2, 'New workspace for a task…'),
  newWindow: word('create', AppWindow, 'New window'),

  // Other views of it.
  changes: word('navigate', FileDiff, 'Show changes'),
  history: word('navigate', History, 'View history'),
  annotate: word('navigate', ScanText, 'Annotate'),
  annotateRevision: word('navigate', ScanText, 'Annotate this revision'),
  compare: word('navigate', GitCompareArrows, 'Compare with another label…'),
  browse: word('navigate', FolderTree),
  showInBranchExplorer: word('navigate', GitGraph, 'Show in Branch Explorer'),
  locks: word('navigate', Lock, 'Show locks'),
  showInLocks: word('navigate', Lock, 'Show in Locks'),
  showInFiles: word('navigate', FolderTree, 'Show in Files'),
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
  paste: word('clipboard', ClipboardPaste, 'Paste'),

  // What it's called, says or is filed under.
  rename: word('edit', Pencil, 'Rename…'),
  editComment: word('edit', MessageSquareText, 'Edit comment…'),
  describe: word('edit', Text, 'Edit description…'),
  move: word('edit', MoveRight, 'Move to another branch…'),
  changelist: word('edit', FolderInput, 'Move to changelist'),
  filterRules: word('edit', EyeOff, 'Ignore, cloak or hide'),
  revisionType: word('edit', Binary, 'Revision type'),
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

/** Where an object's menu shows, when that changes it; what a place adds goes through `withEntries`. */
export interface MenuPlace {
  /** The Branch Explorer, where "Show in Branch Explorer" would lead where the user already is. */
  inBranchExplorer?: boolean;
  /** Called with the name of a branch created from the menu, e.g. to show it. */
  onBranchCreated?: (name: string) => void;
}
