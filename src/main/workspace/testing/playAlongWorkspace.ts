import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { AUTOMATIC_SHELVE_COMMENT } from '@shared/domain/shelve';
import {
  branchFound,
  change,
  diffRecord,
  formatOutput,
  mergeOutput,
  NOTHING_FOUND,
  pendingStatusInChangelists,
  shelvesCreated,
  shelvesFound,
  statusHeader,
  WORKSPACE_NAMES,
} from '../../cm/testing/cmOutput';
import { cmFails, fakeCmClient, optionValue, type CmFailure, type FakeCmCommand } from '../../cm/testing/fakeCmClient';

/** Object ids of the branches the repository has. */
const BRANCH_IDS: Record<string, number> = { '/main': 3, '/main/task1': 37, '/main/task2': 38 };

export interface WorkspaceScenario {
  /** The branch the workspace is on. */
  branch?: string;
  /** The workspace is on this shelve instead of a branch. */
  onShelve?: number;
  /** Pending changes: path → the codes `cm status` prints (`CH`, `AD`, `CO`, `CO+CH`). */
  pending?: Record<string, string>;
  /** The pending changes are a merge from this changeset, still to check in. */
  mergingFrom?: number;
  /** Pending paths in a changelist of the user's. */
  changelists?: { name: string; description: string; paths: string[] }[];
  /** Paths the user holds locks on in this workspace, as `cm lock list` names them (`/src/a.txt`), per repository. */
  locks?: { repository: string; path: string }[];
  /** Shelves already on the server (left by another client, or by this app earlier), with the changes they hold. */
  shelvesOnServer?: { id: number; comment: string; changes: Record<string, string> }[];
  /** Branches `cm find branch` finds; every branch of `BRANCH_IDS` by default. */
  knownBranches?: string[];
  fail?: {
    /** `cm shelveset create` leaves this path out of the shelve. */
    shelveMisses?: string;
    /** `cm shelveset create` shelves changes under an xlink apart, in another repository. */
    shelveSplits?: boolean;
    undo?: string;
    /** Undoing leaves the changes pending. */
    undoLeavesChanges?: boolean;
    /** Switching to this branch fails after moving the workspace there. */
    switchTo?: string;
    /** Switching back to the source fails too. */
    switchBack?: boolean;
    /** Merging a shelve into the workspace finds this many directory conflicts. */
    shelveConflicts?: number;
    /** Merging a shelve into the workspace fails. */
    shelveMerge?: string;
  };
  /** A private file the switch finds in the way of a file it writes, and renames `<path>.private.0`. */
  privateInTheWay?: string;
}

interface Shelve {
  comment: string;
  changes: Record<string, string>;
  /** What the added files held when shelved: merging the shelve writes them back. */
  addedContents: Record<string, string>;
}

const isAdded = (codes: string): boolean => codes.split('+').includes('AD');
const isUnchangedCheckout = (codes: string): boolean => codes === 'CO';

/**
 * A `cm` that plays along with a workspace on disk at `workspacePath`: it keeps the branch, the pending changes, the
 * private files and the shelves, and changes them as `cm` would (undoing an added file leaves it as a private file,
 * merging a shelve brings its changes back). Built on `fakeCmClient`, so every command is recorded and any other fails.
 */
export function playAlongWorkspace(workspacePath: string, scenario: WorkspaceScenario = {}) {
  const fail = scenario.fail ?? {};
  const knownBranches = new Set(scenario.knownBranches ?? Object.keys(BRANCH_IDS));
  let branch = scenario.branch ?? '/main/task1';
  let pending: Record<string, string> = { ...scenario.pending };
  let changelists = scenario.changelists ?? [];
  const privatePaths = new Set<string>(Object.keys(pending).filter((path) => pending[path] === 'PR'));
  const shelves = new Map<number, Shelve>((scenario.shelvesOnServer ?? []).map(({ id, comment, changes }) => [id, { comment, changes, addedContents: {} }]));
  const deletedShelves: number[] = [];
  let nextShelveId = 7;

  const onDisk = (path: string): string => join(workspacePath, ...path.split('/'));
  const relative = (absolute: string): string => absolute.slice(workspacePath.length + 1).split(/[\\/]/).join('/');

  const statusXml = (): string => {
    const inList = new Set(changelists.flatMap((list) => list.paths));
    const merge = scenario.mergingFrom ? `(Merge from ${scenario.mergingFrom})` : '';
    const entries = (paths: string[]): string[] => paths.map((path) => change(pending[path]!, path, { merge }));
    const privates = [...privatePaths].filter((path) => existsSync(onDisk(path))).map((path) => change('PR', path));
    const controlled = Object.keys(pending).filter((path) => pending[path] !== 'PR');
    return pendingStatusInChangelists([
      { name: 'Default', changes: [...entries(controlled.filter((path) => !inList.has(path))), ...privates] },
      ...changelists.map((list) => ({ ...list, changes: entries(list.paths.filter((path) => path in pending)) })),
    ]);
  };

  const createShelve = async ({ args }: FakeCmCommand): Promise<string> => {
    const comment = readFileSync(optionValue(args, '-commentsfile=')!, 'utf8');
    const targets = args.slice(2).filter((arg) => !arg.startsWith('-')).map(relative);
    const shelved = Object.entries(pending).filter(([path, codes]) => codes !== 'PR' && (targets.length === 0 || targets.includes(path)) && path !== fail.shelveMisses);
    const id = nextShelveId++;
    const addedContents = Object.fromEntries(shelved.filter(([path, codes]) => isAdded(codes) && existsSync(onDisk(path))).map(([path]) => [path, readFileSync(onDisk(path), 'utf8')]));
    shelves.set(id, { comment, changes: Object.fromEntries(shelved), addedContents });
    return fail.shelveSplits ? shelvesCreated({ id }, { id: 3, repository: 'lib@local' }) : shelvesCreated({ id });
  };

  const undo = ({ args }: FakeCmCommand): string | CmFailure => {
    if (fail.undo) return cmFails(fail.undo);
    if (fail.undoLeavesChanges) return '';
    const paths = args.includes('-r') ? Object.keys(pending) : args.slice(1).filter((arg) => !arg.startsWith('-')).map(relative);
    for (const path of paths) {
      const codes = pending[path];
      if (codes === undefined || (args.includes('--unchanged') && !isUnchangedCheckout(codes))) continue;
      if (isAdded(codes)) privatePaths.add(path);
      delete pending[path];
    }
    // The changelists stay; what they held isn't pending anymore, and comes back in the default one.
    changelists = changelists.map((list) => ({ ...list, paths: list.paths.filter((path) => path in pending) }));
    return '';
  };

  const switchTo = ({ args }: FakeCmCommand): string | CmFailure => {
    const target = args[1]!.replace(/^br:/, '');
    const back = target === (scenario.branch ?? '/main/task1');
    if (back ? fail.switchBack : target === fail.switchTo) {
      if (!back) branch = target;
      return cmFails('Access to the path is denied.');
    }
    branch = target;
    if (scenario.privateInTheWay) privatePaths.add(`${scenario.privateInTheWay}.private.0`);
    return '';
  };

  const mergeShelve = ({ args }: FakeCmCommand): string | CmFailure => {
    const shelve = shelves.get(Number(args[1]!.slice('sh:'.length)))!;
    if (args.includes('--merge')) {
      if (fail.shelveMerge) return cmFails(fail.shelveMerge);
      pending = { ...pending, ...shelve.changes };
      for (const [path, content] of Object.entries(shelve.addedContents)) {
        mkdirSync(dirname(onDisk(path)), { recursive: true });
        writeFileSync(onDisk(path), content);
      }
      return '';
    }
    const conflicts = Array.from({ length: fail.shelveConflicts ?? 0 }, (_, index) => {
      const path = `/src/conflict${index}.txt`;
      return ['DIR_CONFLICT', 'CHG_RM', 'Change/Delete conflict', 'Changed and deleted.', `Modified ${path}`, `Deleted ${path}`, String(90 + index), 'False', 'CHG', path, 'RM', path];
    });
    return mergeOutput(...Object.keys(shelve.changes).map((path) => ['APPLY', 'ADD', `/${path}`]), ...conflicts);
  };

  const findBranch = ({ args }: FakeCmCommand): string => {
    const shortName = /name = '([^']*)'/.exec(args[2]!)![1];
    const found = [...knownBranches].find((name) => name.split('/').pop() === shortName);
    return found ? branchFound(found, BRANCH_IDS[found]!) : NOTHING_FOUND;
  };

  const fake = fakeCmClient({
    'status --header --xml': () =>
      scenario.onShelve ? statusHeader(String(scenario.onShelve), { type: 'Shelve', changeset: -scenario.onShelve }) : statusHeader(branch),
    getworkspacefrompath: WORKSPACE_NAMES,
    'find branch': findBranch,
    'find shelve': () =>
      shelvesFound(...[...shelves].filter(([, shelve]) => shelve.comment.startsWith(AUTOMATIC_SHELVE_COMMENT)).map(([id, shelve]) => ({ id, comment: shelve.comment }))),
    'status --xml': statusXml,
    'status --short': () => Object.entries(pending).filter(([, codes]) => codes !== 'PR').map(([path, codes]) => `${codes} ${path}\n`).join(''),
    'shelveset create': createShelve,
    'shelveset delete': ({ args }) => {
      const id = Number(/^sh:(\d+)@/.exec(args[2]!)![1]);
      shelves.delete(id);
      deletedShelves.push(id);
      return '';
    },
    diff: ({ args }) =>
      Object.entries(shelves.get(Number(args[1]!.slice('sh:'.length)))?.changes ?? {})
        .map(([path, codes]) => diffRecord(isAdded(codes) ? 'A' : 'C', path, { base: 11, revision: 50 }))
        .join(''),
    undo,
    switch: switchTo,
    merge: mergeShelve,
    'lock list': () =>
      formatOutput(
        ...(scenario.locks ?? []).map(({ repository, path }, index) => [
          repository, 500 + index, `a1b2c3d4-0000-4000-8000-00000000000${index}`, '2026-09-25T10:00:00+02:00', '/main', -1, branch, 60, 'Locked', 'me', 'wk', path,
        ]),
      ),
    changelist: ({ args }) => {
      if (args[1] === 'create') {
        if (changelists.some((list) => list.name === args[2])) return cmFails(`The changelist ${args[2]} already exists.`);
        changelists = [...changelists, { name: args[2]!, description: args[3]!, paths: [] }];
      } else {
        const added = args.slice(3).map(relative);
        changelists = changelists.map((list) => (list.name === args[1] ? { ...list, paths: [...new Set([...list.paths, ...added])] } : list));
      }
      return '';
    },
  });

  return {
    ...fake,
    branch: (): string => branch,
    pending: (): Record<string, string> => pending,
    shelves: (): number[] => [...shelves.keys()],
    shelveComment: (id: number): string | undefined => shelves.get(id)?.comment,
    deletedShelves,
    changelists: () => changelists,
  };
}
