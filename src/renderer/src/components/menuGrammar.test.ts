import '../testing/fakeWindow';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const copied = vi.hoisted(() => [] as { text: string; what: string }[]);
vi.mock('../lib/copyToClipboard', () => ({ copyToClipboard: (text: string, what: string) => copied.push({ text, what }) }));

import type { Branch } from '@shared/domain/branch';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewSummary } from '@shared/domain/codeReview';
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
import { changelistMenu } from '../features/pendingChanges/changelistMenu';
import { pendingChangeMenu } from '../features/pendingChanges/pendingChangeMenu';
import { shelveMenu } from '../features/shelves/shelveMenu';
import { isSubmenu, SEPARATOR, withoutAction, type Action, type MenuEntry, type Submenu } from '../lib/actions';
import { groupOf, MENU_GROUPS } from '../lib/menuGroups';
import { COPY_KINDS } from './copyMenu';
import { MENU_WORDS, type MenuWord } from './menuWords';

const ws = '/ws';
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

const layout = layoutGraph({ ...sampleHistory(), branches: [...sampleHistory().branches, graphBranch('/main/task', '/main', 5)] });
const graphContext = {
  workspacePath: ws,
  layout,
  currentBranch: '/main',
  loadedChangeset: 6,
  repository,
  goToChangeset: () => {},
  showRelatedTo: () => {},
  revealCreatedBranch: () => {},
};
const lane = layout.lanesByBranch.get('/main/a')!;
const resultContext: ResultContext = { workspacePath: ws, term: '', currentBranch: '/main', loadedChangeset: 6, changelists: [], changeAt: () => undefined };

/** Every menu the app builds for an object, one of each kind and situation. */
const MENUS: Record<string, () => MenuEntry[]> = {
  branch: () => branchMenu(ws, [branch], '/main'),
  currentBranch: () => branchMenu(ws, [branch], branch.name),
  branches: () => branchMenu(ws, [branch, { ...branch, name: '/main/other', isHidden: true }], '/main'),
  changeset: () => changesetMenu({ workspacePath: ws, loadedChangeset: 6, loadedBranch: '/main/a' }, [changeset]),
  changesetInterval: () => changesetMenu({ workspacePath: ws }, [changeset, { ...changeset, id: 2 }]),
  label: () => labelMenu(ws, [label]),
  labelPair: () => labelMenu(ws, [label, { ...label, name: 'v2' }]),
  shelve: () => shelveMenu(ws, [shelve]),
  othersShelve: () => shelveMenu(ws, [shelve], { mine: false }),
  leftShelve: () => shelveMenu(ws, [shelve], { left: true }),
  codeReview: () => codeReviewMenu(ws, [review]),
  file: () => fileMenu(ws, [file], new PendingChangesIndex([])),
  folder: () => fileMenu(ws, [{ ...file, path: 'src', name: 'src', itemType: 'directory' }], new PendingChangesIndex([])),
  lockedFile: () => fileMenu(ws, [file], new PendingChangesIndex([change]), pendingLocks),
  pendingChange: () => pendingChangeMenu(ws, [change], [], { isIncluded: () => false, setIncluded: () => {} }),
  lockedPendingChange: () => pendingChangeMenu(ws, [change], [], { isIncluded: () => false, setIncluded: () => {} }, undefined, pendingLocks),
  history: () =>
    historyMenu({ workspacePath: ws, path: 'src/a.ts', ofWorkspaceFile: true, annotate: () => {} }, [
      { kind: 'revision', revision: { revisionId: 40, changesetId: 5, itemType: 'file', repository, idSpec: 'revid:40@game@local', date: '' } } as never,
    ]),
  diffEntry: () => diffEntryMenu(ws, { kind: 'changeset', changesetId: 5 }, [{ path: '/src/a.ts', itemType: 'file', revisionId: 40, baseRevisionId: 39, repository } as never], { statusOf: () => 'unreviewed', toggle: () => {} } as never),
  revision: () => revisionMenu(ws, 5, repository, [file]),
  lock: () => lockMenu(ws, [lock]),
  attributeType: () => attributeTypeMenu(ws, [{ name: 'status', comment: '' } as never]),
  changelist: () => changelistMenu(ws, { name: 'ui', description: '' } as never),
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

const wordOf = (entry: Action | Submenu): MenuWord | undefined => (entry.id ? (MENU_WORDS as Record<string, MenuWord>)[entry.id] : undefined);
const topEntries = (menu: MenuEntry[]): (Action | Submenu)[] => menu.filter((entry): entry is Action | Submenu => entry !== SEPARATOR);

describe('the menu grammar', () => {
  it.each(Object.entries(MENUS))('%s: every entry is a word of the vocabulary, with its icon, group and (where fixed) words', (_name, build) => {
    for (const entry of topEntries(build())) {
      const word = wordOf(entry);
      expect(word, `${entry.id ?? entry.label} is in MENU_WORDS`).toBeDefined();
      expect(groupOf(entry)).toBe(word!.group);
      expect(entry.icon).toBe(word!.icon);
      if (word!.label && !(isSubmenu(entry) === false && entry.label.startsWith(`${word!.label.slice(0, -1)} `))) expect(entry.label).toBe(word!.label);
      if (word!.danger) expect((entry as Action).danger).toBe(true);
    }
  });

  it.each(Object.entries(MENUS))('%s: groups come in the grammar order, a separator between two groups and nowhere else', (_name, build) => {
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

  it.each(Object.entries(MENUS))('%s: what opens a dialog ends with "…", and nothing else does', (_name, build) => {
    for (const entry of topEntries(build())) expect(entry.label).not.toMatch(/\.\.\.$/);
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
    const common = branchMenu(ws, [{ ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' }], '/main');
    const inGraph = withoutAction(common, 'showInBranchExplorer');
    expectOnlyAdds(branchMenu(ws, [{ ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' }], '/main'), common);
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'branch', name: '/main' } }, { kind: 'branch', branch: { ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' } }), common);
    expectOnlyAdds(branchResult({ ...branch, name: '/main/a', parent: '/main', headChangeset: 5, comment: '' }, resultContext).menu!(), common);
    const graph = graphMenu({ kind: 'branch', lane }, graphContext);
    expectOnlyAdds(graph, inGraph);
    expect(reading(graph)).toEqual(expect.arrayContaining([expect.stringContaining('head |'), expect.stringContaining('related |')]));
  });

  it('a changeset reads the same in the Changesets view, Incoming, the top bar, the palette and the Branch Explorer', () => {
    const context = { workspacePath: ws, loadedChangeset: 6, loadedBranch: '/main' };
    const common = changesetMenu(context, [changeset]);
    expectOnlyAdds(changesetResult(changeset, resultContext).menu!(), common);
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'changeset', name: '5' }, loadedChangeset: 5 }, { kind: 'changeset', changeset }), changesetMenu({ ...context, loadedChangeset: 5 }, [changeset]));
    const graph = graphMenu({ kind: 'changeset', id: 5 }, graphContext);
    expectOnlyAdds(graph, withoutAction(changesetMenu({ ...context, repository }, [graphChangeset]), 'showInBranchExplorer'));
    expect(reading(graph)).toEqual(expect.arrayContaining([expect.stringContaining('parent |')]));
  });

  it('a label reads the same in the Labels view, the top bar, the palette and the Branch Explorer', () => {
    const common = labelMenu(ws, [label]);
    expectOnlyAdds(labelResult(label, resultContext).menu!(), common);
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'label', name: 'v1' } }, { kind: 'label', label }), common);
    const graph = graphMenu({ kind: 'label', label: sampleHistory().labels[0]!, more: [] }, graphContext);
    expectOnlyAdds(graph, withoutAction(labelMenu(ws, [{ ...label, comment: '' }]), 'showInBranchExplorer'));
  });

  it('a shelve reads the same in the Shelves view, Changes, its diff, the top bar and the palette', () => {
    const common = shelveMenu(ws, [shelve]);
    expectOnlyAdds(shelveResult(shelve, resultContext).menu!(), common);
    expectOnlyAdds(common, withoutAction(shelveMenu(ws, [shelve]), 'apply'));
    expectOnlyAdds(workingObjectMenu({ ...workspace, selector: { kind: 'shelve', name: '12' } }, { kind: 'shelve', shelve }), shelveMenu(ws, [shelve], { mine: false }));
  });

  it('a code review reads the same in the Code reviews view, the palette and the Branch Explorer', () => {
    const common = codeReviewMenu(ws, [review]);
    expectOnlyAdds(codeReviewResult(review, resultContext).menu!(), common);
    expectOnlyAdds(graphMenu({ kind: 'codeReview', review }, graphContext), common);
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
    expect(copyEntries(branchMenu(ws, [branch], '/main'))[0]!.shortcut).toBe('mod+c');
    expect(await copiedBy(branchMenu(ws, [branch], '/main'))).toEqual([
      'Branch name: /main/task',
      'Branch spec: br:/main/task',
      'Branch full spec: br:/main/task@game@local',
      'Branch comment: The task',
    ]);
  });

  it('copies a changeset as its number, spec, full spec, comment and GUID', async () => {
    expect(await copiedBy(changesetMenu({ workspacePath: ws }, [changeset]))).toEqual([
      'Changeset number: 5',
      'Changeset spec: cs:5',
      'Changeset full spec: cs:5@game@local',
      'Changeset comment: Finish feature',
      'Changeset GUID: c-guid',
    ]);
  });

  it('copies a label as its name, spec, full spec and comment', async () => {
    expect(await copiedBy(labelMenu(ws, [label]))).toEqual(['Label name: v1', 'Label spec: lb:v1', 'Label full spec: lb:v1@game@local', 'Label comment: First']);
  });

  it('copies a shelve as its number, spec, full spec, comment and GUID', async () => {
    expect(await copiedBy(shelveMenu(ws, [shelve]))).toEqual([
      'Shelve number: 12',
      'Shelve spec: sh:12',
      'Shelve full spec: sh:12@game@local',
      'Shelve comment: Spike',
      'Shelve GUID: s-guid',
    ]);
  });

  it('copies a code review as its number and title', async () => {
    expect(await copiedBy(codeReviewMenu(ws, [review]))).toEqual(['Code review number: 9', 'Code review title: Review the task']);
  });

  it('copies files and pending changes as their paths, relative and full', async () => {
    expect(await copiedBy(fileMenu(ws, [file], new PendingChangesIndex([])))).toEqual(['Path: src/a.ts', 'Full path: /ws/src/a.ts']);
    copied.splice(0);
    expect(await copiedBy(pendingChangeMenu(ws, [change, { ...change, path: 'b.ts' }], []))).toEqual(['2 paths: src/a.ts\nb.ts', '2 full paths: /ws/src/a.ts\n/ws/b.ts']);
  });

  it('leaves out what an object has no text for, like an empty comment', () => {
    expect(copyEntries(branchMenu(ws, [{ ...branch, comment: '' }], '/main')).map((entry) => entry.label)).toEqual(['Name', 'Spec', 'Full spec']);
  });

  it('shows what each entry copies next to it', () => {
    expect(copyEntries(labelMenu(ws, [label])).map((entry) => entry.detail)).toEqual(['v1', 'lb:v1', 'lb:v1@game@local', undefined]);
  });
});

describe('shelves', () => {
  const ids = (menu: MenuEntry[]): (string | undefined)[] => topEntries(menu).map((entry) => entry.id);

  it("offers everything on the user's own shelve", () => {
    expect(ids(shelveMenu(ws, [shelve]))).toEqual(['diff', 'apply', 'applyAndDelete', 'newCodeReview', 'copy', 'delete']);
  });

  it("only applies, shows, reviews and copies someone else's: deleting it is theirs to do", () => {
    expect(ids(shelveMenu(ws, [shelve], { mine: false }))).toEqual(['diff', 'apply', 'newCodeReview', 'copy']);
  });
});

describe('the top bar', () => {
  it("offers what the workspace is on with that object's own menu", () => {
    const onBranch = { ...workspace, selector: { kind: 'branch' as const, name: branch.name } };
    expect(reading(workingObjectMenu(onBranch, { kind: 'branch', branch }))).toEqual(reading(branchMenu(ws, [branch], branch.name)));
    const onLabel = { ...workspace, selector: { kind: 'label' as const, name: 'v1' } };
    expect(reading(workingObjectMenu(onLabel, { kind: 'label', label }))).toEqual(reading(labelMenu(ws, [label])));
  });

  it('says it is loading until what the workspace is on is read', () => {
    expect(topEntries(workingObjectMenu(workspace, undefined)).map((entry) => entry.label)).toEqual(['Loading…']);
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
