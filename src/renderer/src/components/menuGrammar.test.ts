import { fakeApi } from '../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const copied = vi.hoisted(() => [] as { text: string; what: string }[]);
vi.mock('../ui/copyToClipboard', () => ({ copyToClipboard: (text: string, what: string) => copied.push({ text, what }) }));

import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReview, CodeReviewSummary } from '@shared/domain/codeReview';
import type { TreeItem } from '@shared/domain/explorer';
import type { Label } from '@shared/domain/label';
import type { Lock } from '@shared/domain/lock';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { Shelve } from '@shared/domain/shelve';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { branchResult, changesetResult, codeReviewResult, labelResult, shelveResult, type ResultContext } from '../app/commands/objectResults';
import { missingWorkspaceMenu, repositoryMenu, workspaceMenu } from '../app/home/homeMenus';
import { currentWorkspaceMenu } from '../app/shell/currentWorkspaceMenu';
import { attributeTypeMenu } from '../features/attributes/attributeTypeMenu';
import { graphMenu } from '../features/branchExplorer/graphMenu';
import { branch as graphBranch, sampleHistory } from '../features/branchExplorer/model/graphFixtures';
import { layoutGraph } from '../features/branchExplorer/model/layoutGraph';
import { branchMenu } from '../features/branches/branchMenu';
import { workingObjectMenu } from '../features/branches/workingObjectMenu';
import { revisionMenu } from '../features/browseRepository/revisionMenu';
import { changesetMenu } from '../features/changesets/changesetMenu';
import { codeReviewMenu } from '../features/codeReviews/codeReviewMenu';
import { diffEntryMenu } from '../features/diff/diffEntryMenu';
import { fileMenu } from '../features/files/fileMenu';
import { PendingChangesIndex } from '../features/files/itemStatus';
import { historyMenu } from '../features/history/historyMenu';
import { labelMenu } from '../features/labels/labelMenu';
import { lockMenu } from '../features/locks/lockMenu';
import { WORKSPACE_ROLES } from '../features/merge/mergeDescription';
import { incomingFileMenu, type IncomingFileMenuContext } from '../features/incoming/incomingFileMenu';
import { mergeProgress } from '../features/merge/mergeItems';
import { mergeItemMenu, type MergeMenuContext } from '../features/merge/mergeItemMenu';
import type { FileConflictState } from '../features/merge/resolve/useFileConflicts';
import { changelistMenu } from '../features/pendingChanges/changelistMenu';
import { pendingChangeMenu } from '../features/pendingChanges/pendingChangeMenu';
import { codeMenu, type CodeMenuActions } from '../features/diff/viewer/codeMenu';
import { lineMenuEntries } from '../features/diff/viewer/lineMenu';
import { shelveMenu } from '../features/shelves/shelveMenu';
import { syncBranchMenu } from '../features/sync/syncBranchMenu';
import { isSubmenu, SEPARATOR, withoutAction, type Action, type MenuEntry, type Submenu } from '../lib/actions';
import { groupedMenu, groupOf, MENU_GROUPS } from '../lib/menuGroups';
import { COPY_KINDS } from './copyMenu';
import { MENU_WORDS, NEEDS_A_WORKSPACE, type MenuWord } from './menuWords';
import { externalAppsKey } from './externalApps/externalApps';
import { queryKeys } from '../api/queryKeys';
import { queryClient } from '../app/queryClient';
import { workspaceInfoQuery } from '../app/workspace/useWorkspace';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { ExternalApps } from '@shared/domain/externalApps';

const ws = '/ws';

/** Apps found, so the menus offer opening items in them ("Open in Visual Studio Code"). */
const FOUND_APPS: ExternalApps = {
  editors: [{ id: 'vscode', name: 'Visual Studio Code', origin: 'known', location: '/Applications/Visual Studio Code.app', opensFolders: true }],
  terminals: [{ id: 'terminal', name: 'Terminal', origin: 'known', location: '/System/Applications/Utilities/Terminal.app', opensFolders: true }],
  editorId: 'vscode',
  terminalId: 'terminal',
};
queryClient.setQueryData(externalAppsKey(DEFAULT_SETTINGS), FOUND_APPS);
const repository = 'game@local';
const branch: Branch = {
  id: 7,
  name: '/main/task',
  parent: '/main',
  comment: 'The task',
  owner: 'jane@example.com',
  date: '2026-09-01T00:00:00Z',
  headChangeset: 5,
  guid: 'b-guid',
  repository,
};
const changeset: Changeset = { id: 5, guid: 'c-guid', branch: '/main/a', comment: 'Finish feature', owner: 'jane@example.com', date: '2026-09-06T00:00:00Z', parent: 4, repository };
const label: Label = { id: 3, name: 'v1', changeset: 6, branch: '/main', comment: 'First', owner: 'jane@example.com', date: '2026-09-07T00:00:00Z', repository };
const shelve: Shelve = { id: 12, guid: 's-guid', comment: 'Spike', owner: 'jane@example.com', date: '2026-09-27T10:00:00Z', parentChangeset: 4, repository };
const review: CodeReviewSummary = { id: 9, title: 'Review the task', status: 'Under review', owner: 'jane@example.com', assignee: '', date: '2026-09-27T10:00:00Z' };
/** The review as the Code reviews view lists it, its branch named. */
const branchReview: CodeReview = { ...review, targetBranchId: branch.id, target: { kind: 'branch', branch: branch.name } };
/** A changeset's review, as every list reads it: its target needs no branch name. */
const changesetReview: CodeReview = { ...review, target: { kind: 'changeset', changesetId: 5 } };
const workspace: WorkspaceInfo = { name: 'game', path: ws, repository, repositoryName: 'game', server: 'local', selector: { kind: 'branch', name: '/main' }, loadedChangeset: 6 };
const file: TreeItem = {
  path: 'src/a.ts',
  name: 'a.ts',
  itemType: 'file',
  size: 10,
  date: '',
  isPrivate: false,
  isCheckedOut: false,
  changeset: 5,
  branch: '/main',
  owner: 'jane@example.com',
  revisionId: 40,
  parentRevisionId: 39,
  repository,
  itemId: 4,
};
/** The workspace's info, as its window reads it: on /main, changeset 5 loaded. */
const WORKSPACE_INFO = { name: 'ws', path: '/ws', repository: 'game@local', repositoryName: 'game', server: 'local', selector: { kind: 'branch', name: '/main' }, loadedChangeset: 5 } as const;
const change: PendingChange = { path: 'src/a.ts', kinds: ['checkedOut', 'changed'], itemType: 'file', size: 10, lastModified: '' };
const lock: Lock = {
  itemId: 1,
  guid: 'l-guid',
  path: '/art/hero.psd',
  owner: 'jane@example.com',
  workspace: 'game',
  status: 'Locked',
  date: '',
  destinationBranch: '/main',
  holderBranch: '/main',
  repository,
};
const pendingLocks = new Map([['src/a.ts', { mine: false, owner: 'ana', workspace: 'art-wk', key: `${repository}:4` }]]);

// /main/task keeps its object id, as the code review of it names it (`targetBranchId`).
const layout = layoutGraph({ ...sampleHistory(), branches: [...sampleHistory().branches, { ...graphBranch('/main/task', '/main', 5), id: branch.id }] });
const graphContext = {
  place: workspacePlace(ws),
  layout,
  currentBranch: '/main',
  loadedChangeset: 6,
  repository,
  goToChangeset: () => {},
  showRelatedTo: () => {},
  revealCreatedBranch: () => {},
};
const lane = layout.lanesByBranch.get('/main/a')!;
const resultContext: ResultContext = { place: workspacePlace(ws), term: '', currentBranch: '/main', loadedChangeset: 6, changelists: [], changeAt: () => undefined };

const mergeVersion = { kind: 'spec', spec: 'itemid:7#cs:11@game@local' } as const;
const mergeConflictState = { file: { key: '7@game@local', path: 'src/a.ts', base: mergeVersion, source: mergeVersion, destination: mergeVersion }, status: 'ready', isBinary: false, decidedByUser: true, resolution: null } as FileConflictState;
/** Every menu the app builds for an object, one of each kind and situation. */
const mergeContext: MergeMenuContext = {
  workspacePath: ws,
  request: { kind: 'merge', sourceSpec: 'br:/main/task' },
  plan: { contributors: { source: { changesetId: 12, branch: '/main/task' }, destination: { changesetId: 10, branch: '/main' } }, fileConflicts: [{ path: '/src/a.ts', sourceChangeset: 11, itemId: 7, repository: 'game@local' }] } as never,
  progress: mergeProgress([mergeConflictState], new Map()),
  labels: { source: '/main/task', destination: '/main', roles: WORKSPACE_ROLES },
  itemTypeOf: () => 'file',
  mergerFor: () => ({ kind: 'tool', tool: { id: 'vscode', name: 'Visual Studio Code' } }) as never,
  othersFor: () => [{ kind: 'tool', tool: { id: 'meld', name: 'Meld' } }] as never,
  running: false,
  decide: () => {},
  reset: () => {},
  resolveIn: () => {},
  resolveDirectory: () => {},
};
const mergeConflict = { kind: 'fileConflict', key: 'file:/src/a.ts', path: 'src/a.ts', file: mergeConflictState.file } as never;
const incomingConflictFile = { path: 'src/a.ts', itemType: 'file', status: 'changed', revisionId: 40, baseRevisionId: 39, repository } as never;
const incomingContext: IncomingFileMenuContext = {
  workspacePath: ws,
  scope: { kind: 'all' },
  loadedChangeset: 1,
  headChangeset: 4,
  conflictOf: () => mergeConflictState,
  mergerFor: () => ({ kind: 'tool', tool: { id: 'vscode', name: 'Visual Studio Code' } }) as never,
  othersFor: () => [{ kind: 'tool', tool: { id: 'meld', name: 'Meld' } }] as never,
  running: false,
  decide: () => {},
  reset: () => {},
  resolveIn: () => {},
};
const mergeDirectoryConflict = {
  kind: 'directoryConflict',
  key: 'directory:0',
  path: 'src/shared',
  index: 0,
  conflict: { type: 'evilTwin', destination: { path: '/src/shared' }, source: { path: '/src/shared' } },
} as never;

const deletedEntry = { status: 'deleted', path: 'src/Enemy.cs', itemType: 'file', revisionId: -1, baseRevisionId: 18, repository } as const;
const deletedFolder = { ...deletedEntry, path: 'docs', itemType: 'directory', baseRevisionId: 24 } as const;

const deletedChange: PendingChange = { path: 'src/Player.cs', kinds: ['locallyDeleted'], itemType: 'file', size: 0, lastModified: '' };
const privateChange: PendingChange = { ...deletedChange, path: 'src/Hero.cs', kinds: ['private'] };

const MENUS: Record<string, () => MenuEntry[]> = {
  branch: () => branchMenu(workspacePlace(ws), [branch], '/main'),
  currentBranch: () => branchMenu(workspacePlace(ws), [branch], branch.name),
  branches: () => branchMenu(workspacePlace(ws), [branch, { ...branch, name: '/main/other', isHidden: true }], '/main'),
  changeset: () => changesetMenu({ place: workspacePlace(ws), loadedChangeset: 6, loadedBranch: '/main/a' }, [changeset]),
  changesetInterval: () => changesetMenu({ place: workspacePlace(ws) }, [changeset, { ...changeset, id: 2 }]),
  label: () => labelMenu(workspacePlace(ws), [label]),
  labelPair: () => labelMenu(workspacePlace(ws), [label, { ...label, name: 'v2' }]),
  shelve: () => shelveMenu(workspacePlace(ws), [shelve]),
  othersShelve: () => shelveMenu(workspacePlace(ws), [shelve], { mine: false }),
  leftShelve: () => shelveMenu(workspacePlace(ws), [shelve], { left: true }),
  codeReview: () => codeReviewMenu(workspacePlace(ws), [review]),
  branchCodeReview: () => codeReviewMenu(workspacePlace(ws), [branchReview], workspace.selector),
  branchCodeReviewOnItsBranch: () => codeReviewMenu(workspacePlace(ws), [branchReview], { kind: 'branch', name: branch.name }),
  changesetCodeReview: () => codeReviewMenu(workspacePlace(ws), [changesetReview], workspace.selector),
  shelveCodeReview: () => codeReviewMenu(workspacePlace(ws), [{ ...review, target: { kind: 'shelve', shelveId: 12 } }], workspace.selector),
  file: () => fileMenu(ws, [file], new PendingChangesIndex([])),
  folder: () => fileMenu(ws, [{ ...file, path: 'src', name: 'src', itemType: 'directory' }], new PendingChangesIndex([])),
  xlink: () => fileMenu(ws, [{ ...file, path: 'lib', name: 'lib', itemType: 'directory', xlink: { writable: true, path: '/', changeset: 4, repository: 'lib', server: 'local' } }], new PendingChangesIndex([])),
  lockedFile: () => fileMenu(ws, [file], new PendingChangesIndex([change]), pendingLocks),
  pendingChange: () => pendingChangeMenu(ws, [change], [], { isIncluded: () => false, setIncluded: () => {} }),
  deletedPendingChange: () => pendingChangeMenu(ws, [deletedChange], [], undefined, undefined, undefined, [deletedChange, privateChange]),
  privatePendingChange: () => pendingChangeMenu(ws, [privateChange], [], undefined, undefined, undefined, [deletedChange, privateChange]),
  lockedPendingChange: () => pendingChangeMenu(ws, [change], [], { isIncluded: () => false, setIncluded: () => {} }, undefined, pendingLocks),
  history: () =>
    historyMenu({ place: workspacePlace(ws), path: 'src/a.ts', ofWorkspaceFile: true, annotate: () => {} }, [
      { kind: 'revision', revision: { revisionId: 40, changesetId: 5, itemType: 'file', repository, idSpec: 'revid:40@game@local', date: '' } } as never,
    ]),
  diffEntry: () =>
    diffEntryMenu(
      workspacePlace(ws),
      { kind: 'changeset', changesetId: 5 },
      [{ status: 'changed', path: '/src/a.ts', itemType: 'file', revisionId: 40, baseRevisionId: 39, repository } as never],
      { review: { statusOf: () => 'unreviewed', toggle: () => {} } as never, workspaceRepository: repository },
    ),
  deletedDiffEntry: () => diffEntryMenu(workspacePlace(ws), { kind: 'changeset', changesetId: 5 }, [deletedEntry], { workspaceRepository: repository }),
  deletedDiffEntries: () => diffEntryMenu(workspacePlace(ws), { kind: 'changeset', changesetId: 5 }, [deletedEntry, deletedFolder], { workspaceRepository: repository }),
  mergeConflict: () => mergeItemMenu([mergeConflict], mergeContext),
  mergeChange: () => mergeItemMenu([{ kind: 'change', key: 'change:0', path: 'src/c.ts', change: { kind: 'changed', path: '/src/c.ts' } }], mergeContext),
  mergeDirectoryConflict: () => mergeItemMenu([mergeDirectoryConflict], mergeContext),
  mergeSeveral: () => mergeItemMenu([mergeConflict, mergeConflict], mergeContext),
  incomingConflict: () => incomingFileMenu([incomingConflictFile], incomingContext),
  incomingSeveralConflicts: () => incomingFileMenu([incomingConflictFile, incomingConflictFile], incomingContext),
  revision: () => revisionMenu(workspacePlace(ws), 5, repository, [file]),
  lock: () => lockMenu(workspacePlace(ws), [lock]),
  syncBranch: () => syncBranchMenu([branch], 'game@cloud', { push: () => {}, pull: () => {} }),
  attributeType: () => attributeTypeMenu(workspacePlace(ws), [{ name: 'status', comment: '' } as never]),
  changelist: () => changelistMenu(ws, { name: 'ui', description: '' }, { changes: [{ ...change, changelist: 'ui' }], prepare: () => {} }),
  workspace: () => workspaceMenu({ name: 'game', path: ws, guid: 'w' }, () => {}),
  missingWorkspace: () => missingWorkspaceMenu({ name: 'game', path: ws, guid: 'w' }, () => {}),
  repository: () => repositoryMenu({ id: '1', name: 'game', server: 'local', owner: '', spec: repository }, () => {}),
  currentWorkspace: () => currentWorkspaceMenu(ws, 'game'),
  graphChangeset: () => graphMenu({ kind: 'changeset', id: 5 }, graphContext),
  graphBranch: () => graphMenu({ kind: 'branch', lane }, graphContext),
  graphLabel: () => graphMenu({ kind: 'label', label: sampleHistory().labels[0]!, more: [] }, graphContext),
  graphCodeReview: () => graphMenu({ kind: 'codeReview', review }, graphContext),
  graphMergeLink: () => graphMenu({ kind: 'mergeLink', link: sampleHistory().mergeLinks[0]! }, graphContext),
};

/**
 * The object menus a repository explored without a workspace shows, built for one: none offers what needs a
 * workspace (`NEEDS_A_WORKSPACE`), and every other rule of the grammar holds (they join `MENUS`' checks below).
 */
const onRepository = repositoryPlace(repository);
const REPOSITORY_MENUS: Record<string, () => MenuEntry[]> = {
  repositoryBranch: () => branchMenu(onRepository, [branch], undefined),
  repositoryBranches: () => branchMenu(onRepository, [branch, { ...branch, name: '/main/other', isHidden: true }], undefined),
  repositoryChangeset: () => changesetMenu({ place: onRepository }, [changeset]),
  repositoryChangesetInterval: () => changesetMenu({ place: onRepository }, [changeset, { ...changeset, id: 2 }]),
  repositoryLabel: () => labelMenu(onRepository, [label]),
  repositoryLabelPair: () => labelMenu(onRepository, [label, { ...label, name: 'v2' }]),
  repositoryAttributeType: () => attributeTypeMenu(onRepository, [{ name: 'status', comment: '' } as never]),
  repositoryCodeReview: () => codeReviewMenu(onRepository, [branchReview]),
  repositoryCodeReviews: () => codeReviewMenu(onRepository, [review, changesetReview]),
  repositoryShelve: () => shelveMenu(onRepository, [shelve]),
  repositoryRevision: () => revisionMenu(onRepository, 5, repository, [file]),
  repositoryLock: () => lockMenu(onRepository, [lock]),
  repositoryDiffEntry: () =>
    diffEntryMenu(onRepository, { kind: 'changeset', changesetId: 5 }, [deletedEntry], { review: { statusOf: () => 'unreviewed', toggle: () => {} } as never, workspaceRepository: repository }),
  repositoryHistory: () =>
    historyMenu({ place: onRepository, path: 'src/a.ts', ofWorkspaceFile: false, annotate: () => {} }, [
      { kind: 'revision', revision: { revisionId: 40, changesetId: 5, itemType: 'file', repository, idSpec: 'revid:40@game@local', date: '' } } as never,
    ]),
  repositoryGraphChangeset: () => graphMenu({ kind: 'changeset', id: 5 }, { ...graphContext, place: onRepository, currentBranch: undefined, loadedChangeset: undefined }),
  repositoryGraphBranch: () => graphMenu({ kind: 'branch', lane }, { ...graphContext, place: onRepository, currentBranch: undefined, loadedChangeset: undefined }),
  repositoryGraphLabel: () => graphMenu({ kind: 'label', label: sampleHistory().labels[0]!, more: [] }, { ...graphContext, place: onRepository }),
};

/**
 * Menus of lines of code, not of an object: what they copy is the lines' link and text, so they have their own "Copy …"
 * entries and no object's "Copy" submenu. Every other rule of the grammar holds.
 */
const LINE_MENUS: Record<string, () => MenuEntry[]> = {
  diffLines: () => groupedMenu(lineMenuEntries({ lines: { side: 'new', first: 40, last: 52 }, copyLink: () => {}, copyLines: () => {}, annotate: () => {} })),
  annotatedLine: () => groupedMenu(lineMenuEntries({ lines: { side: 'new', first: 42, last: 42 }, copyLink: () => {}, copyLines: () => {} })),
};
const textActions = Object.fromEntries(['undo', 'redo', 'cut', 'copy', 'paste', 'delete', 'selectAll', 'goToLine', 'find', 'replace', 'compareWithClipboard'].map((name) => [name, () => {}])) as unknown as CodeMenuActions;
/** Menus of code, the text typed into or read (`codeMenu`): their Copy copies the text selected, not an object's names. */
const TEXT_MENUS: Record<string, () => MenuEntry[]> = {
  typedText: () => codeMenu({ editable: true, selectedText: true, selectedCode: true, canUndo: true, canRedo: true, canSelectAll: true }, textActions),
  readText: () => codeMenu({ editable: false, selectedText: true, selectedCode: true, canUndo: false, canRedo: false, canSelectAll: false }, textActions),
  committedDiffText: () =>
    codeMenu({ editable: false, selectedText: true, selectedCode: true, canUndo: false, canRedo: false, canSelectAll: true }, textActions, lineMenuEntries({ lines: { side: 'new', first: 40, last: 52 }, copyLink: () => {}, copyLines: () => {}, annotate: () => {} })),
};
const CODE_MENUS = { ...LINE_MENUS, ...TEXT_MENUS };
const EVERY_MENU = { ...MENUS, ...REPOSITORY_MENUS, ...CODE_MENUS };

const wordOf = (entry: Action | Submenu): MenuWord | undefined => (entry.id ? (MENU_WORDS as Record<string, MenuWord>)[entry.id] : undefined);
const topEntries = (menu: MenuEntry[]): (Action | Submenu)[] => menu.filter((entry): entry is Action | Submenu => entry !== SEPARATOR);

describe('menus without a workspace', () => {
  const ids = (menu: MenuEntry[]): string[] => topEntries(menu).map((entry) => entry.id ?? '');

  it.each(Object.entries(REPOSITORY_MENUS))('%s: offers nothing that needs a workspace', (_name, build) => {
    expect(ids(build()).filter((id) => (NEEDS_A_WORKSPACE as readonly string[]).includes(id))).toEqual([]);
  });

  it("keeps what changes the server's objects, as in a workspace", () => {
    expect(ids(REPOSITORY_MENUS.repositoryBranch!())).toEqual(expect.arrayContaining(['diff', 'newBranch', 'changesets', 'copy', 'rename', 'hide', 'delete']));
    expect(ids(REPOSITORY_MENUS.repositoryChangeset!())).toEqual(expect.arrayContaining(['diff', 'newBranch', 'compare', 'browse', 'copy', 'editComment', 'move', 'delete']));
    expect(ids(REPOSITORY_MENUS.repositoryChangesetInterval!())).toEqual(['diffRange']);
    expect(ids(REPOSITORY_MENUS.repositoryChangeset!())).toContain('newLabel');
    expect(ids(REPOSITORY_MENUS.repositoryLabel!())).toEqual(expect.arrayContaining(['diff', 'newBranch', 'compare', 'browse', 'copy', 'rename', 'delete']));
    expect(ids(REPOSITORY_MENUS.repositoryCodeReview!())).toEqual(expect.arrayContaining(['openReview', 'status', 'assign', 'copy', 'delete']));
    expect(ids(REPOSITORY_MENUS.repositoryBranch!())).toContain('newCodeReview');
  });

  it('offers in a workspace what a repository leaves out, so the list names what each needs', () => {
    expect(ids(MENUS.branch!())).toEqual(expect.arrayContaining(['switch', 'merge', 'mergeTo', 'cherryPick']));
  });
});

describe('the menu grammar', () => {
  it.each(Object.entries(EVERY_MENU))('%s: every entry is a word of the vocabulary, with its icon, group and (where fixed) words', (_name, build) => {
    for (const entry of topEntries(build())) {
      const word = wordOf(entry);
      expect(word, `${entry.id ?? entry.label} is in MENU_WORDS`).toBeDefined();
      expect(groupOf(entry)).toBe(word!.group);
      expect(entry.icon).toBe(word!.icon);
      if (word!.label && !(isSubmenu(entry) === false && entry.label.startsWith(`${word!.label.slice(0, -1)} `))) expect(entry.label).toBe(word!.label);
      if (word!.danger) expect((entry as Action).danger).toBe(true);
    }
  });

  it.each(Object.entries(EVERY_MENU))('%s: groups come in the grammar order, a separator between two groups and nowhere else', (_name, build) => {
    const menu = build();
    expect(menu.length).toBeGreaterThan(0);
    expect(menu[0]).not.toBe(SEPARATOR);
    expect(menu.at(-1)).not.toBe(SEPARATOR);
    menu.forEach((entry, index) => {
      if (index === 0) return;
      const previous = menu[index - 1]!;
      if (entry === SEPARATOR) {
        expect(previous).not.toBe(SEPARATOR);
        expect(MENU_GROUPS.indexOf(groupOf(menu[index + 1]!)!)).toBeGreaterThan(MENU_GROUPS.indexOf(groupOf(previous)!));
      } else if (previous !== SEPARATOR) {
        expect(groupOf(entry)).toBe(groupOf(previous));
      }
    });
  });

  it.each(Object.entries(MENUS))('%s: at most one "Copy" submenu, its entries in the order of every other', (_name, build) => {
    const copies = topEntries(build()).filter((entry) => isSubmenu(entry) && entry.id === 'copy') as Submenu[];
    expect(copies.length).toBeLessThanOrEqual(1);
    expect(topEntries(build()).filter((entry) => !isSubmenu(entry) && entry.label.startsWith('Copy'))).toEqual([]);
    const kinds = (copies[0]?.entries ?? []).map((entry) => (entry as Action).id.replace('copy.', ''));
    expect(kinds).toEqual(COPY_KINDS.filter((kind) => kinds.includes(kind)));
  });

  it.each(Object.entries(EVERY_MENU))('%s: what opens a dialog ends with "…", and nothing else does', (_name, build) => {
    for (const entry of topEntries(build())) expect(entry.label).not.toMatch(/\.\.\.$/);
  });
});

/** The object menus that offer the user's tools, each with the objects a tool can run on. */
const MENUS_WITH_TOOLS = [
  'branch',
  'branches',
  'changeset',
  'changesetInterval',
  'label',
  'labelPair',
  'file',
  'folder',
  'pendingChange',
  'history',
  'diffEntry',
  'revision',
  'repositoryBranch',
  'repositoryChangeset',
  'repositoryLabel',
  'repositoryRevision',
  'repositoryHistory',
];

describe("the user's tools", () => {
  const everything = { id: 'tool:1', name: 'Post', program: '/opt/post', args: ['{object}'], targets: ['item', 'changeset', 'branch', 'label'] } as const;
  beforeEach(() => queryClient.setQueryData(queryKeys.settings, { ...DEFAULT_SETTINGS, tools: [{ ...everything, targets: [...everything.targets] }] }));
  afterEach(() => queryClient.removeQueries({ queryKey: queryKeys.settings }));

  it.each(MENUS_WITH_TOOLS)('%s: shows them in one "Tools" submenu, with the OS, keeping the grammar order', (name) => {
    const menu = EVERY_MENU[name]!();
    const tools = topEntries(menu).filter((entry) => entry.id === 'tools');
    expect(tools).toHaveLength(1);
    expect(groupOf(tools[0]!)).toBe('external');
    const groups = topEntries(menu).map((entry) => MENU_GROUPS.indexOf(groupOf(entry)!));
    expect(groups).toEqual([...groups].sort((a, b) => a - b));
  });

  it('leaves them out of a change no longer on disk, which has nothing to run on', () => {
    expect(topEntries(MENUS.deletedPendingChange!()).map((entry) => entry.id)).not.toContain('tools');
  });
});

describe('lines of code', () => {
  it.each(Object.entries(LINE_MENUS))('%s: copies the lines\' link and text, and no object\'s Copy submenu', (_name, build) => {
    const entries = topEntries(build());
    expect(entries.filter((entry) => entry.id === 'copy')).toEqual([]);
    expect(entries.filter((entry) => entry.label.startsWith('Copy')).map((entry) => entry.id)).toEqual(expect.arrayContaining(['copyLines']));
  });
});

describe('text', () => {
  it.each(Object.entries(TEXT_MENUS))("%s: copies the text selected, and no object's Copy submenu", (_name, build) => {
    const entries = topEntries(build());
    expect(entries.filter((entry) => entry.id === 'copy')).toEqual([]);
    expect(entries.map((entry) => entry.id)).toContain('copyText');
  });

  it("reads, in a committed diff, as the code's menu with the lines' entries at the end of their groups", () => {
    expect(topEntries(TEXT_MENUS.committedDiffText!()).map((entry) => entry.label)).toEqual([
      'Go to line…',
      'Compare with clipboard',
      'Annotate at these lines',
      'Copy',
      'Copy link to lines 40–52',
      'Copy lines',
      'Select all',
    ]);
  });
});

describe('Compare with another', () => {
  const comparing = (menu: MenuEntry[]) => topEntries(menu).filter((entry) => entry.id === 'compare').map((entry) => entry.label);

  it('compares one branch, changeset or label with another of its kind, wherever it shows', () => {
    expect(comparing(MENUS.branch!())).toEqual(['Compare with another branch…']);
    expect(comparing(MENUS.currentBranch!())).toEqual(['Compare with another branch…']);
    expect(comparing(MENUS.graphBranch!())).toEqual(['Compare with another branch…']);
    expect(comparing(MENUS.changeset!())).toEqual(['Compare with another changeset…']);
    expect(comparing(MENUS.graphChangeset!())).toEqual(['Compare with another changeset…']);
    expect(comparing(MENUS.label!())).toEqual(['Compare with another label…']);
  });

  it("sits with a branch's other views: its changesets, then comparing, then the Branch Explorer", () => {
    const navigating = (menu: MenuEntry[]) => topEntries(menu).filter((entry) => groupOf(entry) === 'navigate').map((entry) => entry.label);
    expect(navigating(MENUS.branch!())).toEqual(['Show changesets', 'Compare with another branch…', 'Show in Branch Explorer']);
    expect(navigating(MENUS.graphBranch!()).slice(0, 2)).toEqual(['Show changesets', 'Compare with another branch…']);
  });

  it('leaves it out of a selection of several, which compares them or nothing', () => {
    expect(comparing(MENUS.branches!())).toEqual([]);
    expect(comparing(MENUS.changesetInterval!())).toEqual([]);
    expect(comparing(MENUS.labelPair!())).toEqual([]);
  });
});

/** What a menu shows, flattened with the "Copy" submenu's entries: the words, icons and order people read. */
function reading(menu: MenuEntry[]): string[] {
  return topEntries(menu).flatMap((entry) => {
    const own = `${entry.id} | ${entry.label} | ${entry.icon?.displayName ?? (entry.icon as { name?: string } | undefined)?.name ?? ''}`;
    return isSubmenu(entry) && entry.id === 'copy' ? [own, ...entry.entries.map((copy) => `  ${(copy as Action).id} | ${(copy as Action).label}`)] : [own];
  });
}

/** Whether `place` reads as `common` with entries added, the common ones keeping their words and order. */
function expectOnlyAdds(place: MenuEntry[], common: MenuEntry[]): void {
  const placeLines = reading(place);
  const commonLines = reading(common);
  expect(placeLines.filter((line) => commonLines.includes(line))).toEqual(commonLines);
}

describe('one menu per object, the same everywhere', () => {
  const graphChangeset = { ...changeset, id: 5, branch: '/main/a', parent: 4, comment: 'Finish feature', guid: undefined };

  it('a branch reads the same in the Branches view, the switcher, the top bar, the palette and the Branch Explorer', () => {
    const common = branchMenu(workspacePlace(ws), [{ ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' }], '/main');
    const inGraph = withoutAction(common, 'showInBranchExplorer');
    expectOnlyAdds(branchMenu(workspacePlace(ws), [{ ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' }], '/main'), common);
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'branch', name: '/main' } }, { kind: 'branch', branch: { ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' } }), common);
    expectOnlyAdds(branchResult({ ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' }, resultContext).menu!(), common);
    const graph = graphMenu({ kind: 'branch', lane }, graphContext);
    expectOnlyAdds(graph, inGraph);
    expect(reading(graph)).toEqual(expect.arrayContaining([expect.stringContaining('head |'), expect.stringContaining('related |')]));
  });

  it('a changeset reads the same in the Changesets view, Incoming, the top bar, the palette and the Branch Explorer', () => {
    const context = { place: workspacePlace(ws), loadedChangeset: 6, loadedBranch: '/main' };
    const common = changesetMenu(context, [changeset]);
    expectOnlyAdds(changesetResult(changeset, resultContext).menu!(), common);
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'changeset', name: '5' }, loadedChangeset: 5 }, { kind: 'changeset', changeset }), changesetMenu({ ...context, loadedChangeset: 5 }, [changeset]));
    const graph = graphMenu({ kind: 'changeset', id: 5 }, graphContext);
    expectOnlyAdds(graph, withoutAction(changesetMenu({ ...context, repository }, [graphChangeset]), 'showInBranchExplorer'));
    expect(reading(graph)).toEqual(expect.arrayContaining([expect.stringContaining('parent |')]));
  });

  it('a label reads the same in the Labels view, the top bar, the palette and the Branch Explorer', () => {
    const common = labelMenu(workspacePlace(ws), [label]);
    expectOnlyAdds(labelResult(label, resultContext).menu!(), common);
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'label', name: 'v1' } }, { kind: 'label', label }), common);
    const graph = graphMenu({ kind: 'label', label: sampleHistory().labels[0]!, more: [] }, graphContext);
    expectOnlyAdds(graph, withoutAction(labelMenu(workspacePlace(ws), [{ ...label, comment: '' }]), 'showInBranchExplorer'));
  });

  it('a shelve reads the same in the Shelves view, Changes, its diff, the top bar and the palette', () => {
    const common = shelveMenu(workspacePlace(ws), [shelve]);
    expectOnlyAdds(shelveResult(shelve, resultContext).menu!(), common);
    expectOnlyAdds(common, withoutAction(shelveMenu(workspacePlace(ws), [shelve]), 'apply'));
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'shelve', name: '12' } }, { kind: 'shelve', shelve }), shelveMenu(workspacePlace(ws), [shelve], { mine: false }));
  });

  it("a changed file reads the same in a diff, Incoming and a merge, the merge only adding its own", () => {
    // A diff no link names (two branches' heads), as a merge's and Incoming's files have no one object to link to.
    const inDiff = diffEntryMenu(workspacePlace(ws), { kind: 'range', fromSpec: 'br:/main', toSpec: 'cs:5' }, [{ path: 'src/a.ts', itemType: 'file', revisionId: 40, baseRevisionId: 39, repository } as never]);
    expectOnlyAdds(mergeItemMenu([mergeConflict], mergeContext), inDiff);
    expectOnlyAdds(incomingFileMenu([incomingConflictFile], incomingContext), inDiff);
  });

  it('a code review reads the same in the Code reviews view, the palette and the Branch Explorer', () => {
    const inView = codeReviewMenu(workspacePlace(ws), [branchReview], workspace.selector);
    const { target: _named, ...asSearched } = branchReview;
    expectOnlyAdds(graphMenu({ kind: 'codeReview', review: asSearched }, graphContext), inView);
    // The one exception (ARCHITECTURE.md "Menus"): the palette's searches don't name a branch, so it can't switch to it.
    expectOnlyAdds(codeReviewResult(asSearched, resultContext).menu!(), withoutAction(inView, 'switch'));
    expectOnlyAdds(codeReviewResult(changesetReview, resultContext).menu!(), codeReviewMenu(workspacePlace(ws), [changesetReview], workspace.selector));
  });
});

describe('Copy', () => {
  beforeEach(() => void copied.splice(0));

  const copyEntries = (menu: MenuEntry[]): Action[] =>
    ((topEntries(menu).find((entry) => isSubmenu(entry) && entry.id === 'copy') as Submenu | undefined)?.entries ?? []) as Action[];
  const copiedBy = async (menu: MenuEntry[]) => {
    for (const entry of copyEntries(menu)) entry.run();
    await new Promise((resolve) => setTimeout(resolve));
    return copied.map(({ text, what }) => `${what}: ${text}`);
  };

  it('copies a branch as its name, spec, full spec and comment, the name with ⌘C', async () => {
    expect(copyEntries(branchMenu(workspacePlace(ws), [branch], '/main'))[0]!.shortcut).toBe('mod+c');
    expect(copyEntries(branchMenu(workspacePlace(ws), [branch], '/main')).find((entry) => entry.id === 'copy.link')!.shortcut).toBe('mod+shift+c');
    expect(await copiedBy(branchMenu(workspacePlace(ws), [branch], '/main'))).toEqual([
      'Branch name: /main/task',
      'Branch link: uvcs://local/repos/game/branches/main/task',
      'Branch spec: br:/main/task',
      'Branch full spec: br:/main/task@game@local',
      'Branch comment: The task',
    ]);
  });

  it('copies a changeset as its number, spec, full spec, comment and GUID', async () => {
    expect(await copiedBy(changesetMenu({ place: workspacePlace(ws) }, [changeset]))).toEqual([
      'Changeset number: 5',
      'Changeset link: uvcs://local/repos/game/changesets/5',
      'Changeset spec: cs:5',
      'Changeset full spec: cs:5@game@local',
      'Changeset comment: Finish feature',
      'Changeset GUID: c-guid',
    ]);
  });

  it('copies a label as its name, spec, full spec and comment', async () => {
    expect(await copiedBy(labelMenu(workspacePlace(ws), [label]))).toEqual(['Label name: v1', 'Label link: uvcs://local/repos/game/labels/v1', 'Label spec: lb:v1', 'Label full spec: lb:v1@game@local', 'Label comment: First']);
  });

  it('copies a shelve as its number, spec, full spec, comment and GUID', async () => {
    expect(await copiedBy(shelveMenu(workspacePlace(ws), [shelve]))).toEqual([
      'Shelve number: 12',
      'Shelve link: uvcs://local/repos/game/shelves/12',
      'Shelve spec: sh:12',
      'Shelve full spec: sh:12@game@local',
      'Shelve comment: Spike',
      'Shelve GUID: s-guid',
    ]);
  });

  it("copies a code review as its number, title and link, in the workspace's repository", async () => {
    fakeApi.answer('workspaces.info', async () => WORKSPACE_INFO);
    expect(await copiedBy(codeReviewMenu(workspacePlace(ws), [review]))).toEqual(['Code review number: 9', 'Code review title: Review the task', 'Code review link: uvcs://local/repos/game/code-reviews/9']);
  });

  it('copies a code review of a repository explored without a workspace with the link naming that repository, asking nothing', async () => {
    expect(await copiedBy(codeReviewMenu(onRepository, [review]))).toEqual(['Code review number: 9', 'Code review title: Review the task', 'Code review link: uvcs://local/repos/game/code-reviews/9']);
    expect(fakeApi.calls()).toEqual([]);
  });

  it("copies a diff's file as the link to its change there", async () => {
    fakeApi.answer('workspaces.info', async () => WORKSPACE_INFO);
    const entry = { path: 'src/a.ts', itemType: 'file', revisionId: 40, baseRevisionId: 39, repository } as never;
    expect(await copiedBy(diffEntryMenu(workspacePlace(ws), { kind: 'changeset', changesetId: 5 }, [entry]))).toEqual(['Path: src/a.ts', 'Link: uvcs://local/repos/game/changesets/5/-/files/src/a.ts']);
  });

  it("copies files and pending changes as their paths, relative and full, and a file as its link on the workspace's branch", async () => {
    queryClient.setQueryData(workspaceInfoQuery(ws).queryKey, WORKSPACE_INFO);
    expect(await copiedBy(fileMenu(ws, [file], new PendingChangesIndex([])))).toEqual(['Path: src/a.ts', 'Full path: /ws/src/a.ts', 'Link: uvcs://local/repos/game/branches/main/-/browse/src/a.ts']);
    expect(copyEntries(fileMenu(ws, [{ ...file, repository: '', isPrivate: true }], new PendingChangesIndex([]))).map((entry) => entry.label)).toEqual(['Path', 'Full path']);
    copied.splice(0);
    expect(await copiedBy(pendingChangeMenu(ws, [change, { ...change, path: 'b.ts' }], []))).toEqual(['2 paths: src/a.ts\nb.ts', '2 full paths: /ws/src/a.ts\n/ws/b.ts']);
  });

  it('leaves out what an object has no text for, like an empty comment', () => {
    expect(copyEntries(branchMenu(workspacePlace(ws), [{ ...branch, comment: '' }], '/main')).map((entry) => entry.label)).toEqual(['Name', 'Link', 'Spec', 'Full spec']);
  });

  it('shows what each entry copies next to it', () => {
    // A link is too long to read beside its label, as a comment is.
    expect(copyEntries(labelMenu(workspacePlace(ws), [label])).map((entry) => entry.detail)).toEqual(['v1', undefined, 'lb:v1', 'lb:v1@game@local', undefined]);
  });
});

describe('shelves', () => {
  const ids = (menu: MenuEntry[]): (string | undefined)[] => topEntries(menu).map((entry) => entry.id);

  it("offers everything on the user's own shelve", () => {
    expect(ids(shelveMenu(workspacePlace(ws), [shelve]))).toEqual(['diff', 'diffInNewWindow', 'apply', 'applyAndDelete', 'newCodeReview', 'copy', 'editComment', 'delete']);
  });

  it("only applies, shows, reviews and copies someone else's: describing and deleting it is theirs to do", () => {
    expect(ids(shelveMenu(workspacePlace(ws), [shelve], { mine: false }))).toEqual(['diff', 'diffInNewWindow', 'apply', 'newCodeReview', 'copy']);
  });
});

describe('the top bar', () => {
  it("offers what the workspace is on with that object's own menu", () => {
    const onBranch = { ...workspace, selector: { kind: 'branch' as const, name: branch.name } };
    expect(reading(workingObjectMenu(onBranch, { kind: 'branch', branch }))).toEqual(reading(branchMenu(workspacePlace(ws), [branch], branch.name)));
    const onLabel = { ...workspace, selector: { kind: 'label' as const, name: 'v1' } };
    expect(reading(workingObjectMenu(onLabel, { kind: 'label', label }))).toEqual(reading(labelMenu(workspacePlace(ws), [label])));
  });

  it('says it is loading until what the workspace is on is read', () => {
    expect(topEntries(workingObjectMenu(workspace, undefined)).map((entry) => entry.label)).toEqual(['Loading…']);
  });
});

describe('opening', () => {
  const REVEAL = 'Reveal in Finder';
  /** The menu's opening group: every way to open it in other apps, first after what opens in the app. */
  const opening = (menu: MenuEntry[]): string[] => {
    const entries = topEntries(menu).filter((entry) => groupOf(entry) !== 'primary');
    expect(groupOf(entries[0]!)).toBe('open');
    return entries.filter((entry) => groupOf(entry) === 'open').map((entry) => entry.label);
  };

  it("opens a file on disk first, in the user's editor, in the same words wherever it shows: the Files view, Changes and the palette", () => {
    const words = ['Open in Visual Studio Code', 'Open with', REVEAL];
    expect(opening(MENUS.file!())).toEqual(words);
    expect(opening(MENUS.pendingChange!())).toEqual(words);
  });

  it("opens a folder, and the workspace itself, in the editor and the terminal first; the workspace's contents in Finder", () => {
    const words = ['Open in Visual Studio Code', 'Open in Terminal', 'Open with'];
    expect(opening(MENUS.folder!())).toEqual([...words, REVEAL]);
    expect(opening(MENUS.currentWorkspace!())).toEqual([...words, 'Open in Finder']);
    expect(opening(MENUS.workspace!())).toEqual([...words, 'Open in Finder']);
    expect(reading(MENUS.workspace!()).slice(0, 2)).toEqual([
      expect.stringContaining('openWorkspace | Open workspace'),
      expect.stringContaining('openInNewWindow | Open in new window'),
    ]);
    expect(MENUS.workspace!()[2]).toBe(SEPARATOR);
  });

  it("opens a revision first, in the user's editor or any other app", () => {
    const words = ['Open this revision in Visual Studio Code', 'Open this revision with'];
    expect(opening(MENUS.revision!())).toEqual(words);
    expect(opening(MENUS.history!())).toEqual(words);
    expect(opening(MENUS.diffEntry!())).toEqual(words);
  });
});

describe('locks', () => {
  const ids = (menu: MenuEntry[]): (string | undefined)[] => topEntries(menu).map((entry) => entry.id);

  it('a locked file or pending change leads to its lock, where any other file leads to the Locks view', () => {
    expect(ids(MENUS.lockedFile!())).toContain('showInLocks');
    expect(ids(MENUS.lockedFile!())).not.toContain('locks');
    expect(ids(MENUS.file!())).toContain('locks');
    expect(ids(MENUS.lockedPendingChange!())).toContain('showInLocks');
    expect(ids(MENUS.pendingChange!())).not.toContain('showInLocks');
  });
});

describe("a changeset's menu", () => {
  const shortcuts = (entries: MenuEntry[]): Record<string, string> =>
    Object.fromEntries(
      entries.flatMap((entry) => (isSubmenu(entry) ? entry.entries : [entry])).flatMap((entry) => (typeof entry === 'object' && 'run' in entry && entry.shortcut ? [[entry.id, entry.shortcut]] : [])),
    );

  it('names the list keys on what they do in a list that binds them', () => {
    expect(shortcuts(changesetMenu({ place: workspacePlace(ws) }, [changeset]))).toEqual({ diff: 'mod+d', 'copy.number': 'mod+c', 'copy.link': 'mod+shift+c' });
  });

  it('names no shortcut where the list keys reach something else, as in a branch diff stepped changeset by changeset', () => {
    const menu = changesetMenu({ place: workspacePlace(ws) }, [changeset], { listKeysElsewhere: true });

    expect(shortcuts(menu)).toEqual({});
    expect(menu.some((entry) => isSubmenu(entry) && entry.entries.some((copy) => typeof copy === 'object' && 'id' in copy && copy.id === 'copy.link'))).toBe(true);
  });
});
