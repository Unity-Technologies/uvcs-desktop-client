import type { KnownBranch } from '@shared/domain/branch';
import type { Shelve } from '@shared/domain/shelve';
import { parseShelveGuid } from '@shared/domain/stableIds';
import type { LeftChanges, SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { selectorPlace } from './switchSelectors';

/** A record of changes the app shelved to switch or update: never one the user shelved away. */
export type LeftChangesRecord = SwitchShelveRecord & { reason?: LeftChanges['reason'] };

/** Shelved by the app to switch or update, not by the user: only these are "Welcome back"'s, and restored on arrival. */
export function isLeftChanges(record: SwitchShelveRecord): record is LeftChangesRecord {
  return record.reason !== 'shelve';
}

/**
 * What the workspace is on, as records are matched to it: by its spec (`br:/main/task`), and by its object id (`br:37`,
 * `cs:12`) when that is known without asking the server. A rename changes the spec, never the id.
 */
export interface WorkspaceSpot {
  spec: string;
  /** As shown: `/main/task`. */
  name: string;
  objectRef?: string;
}

/** Where a record's changes were made or went: its spec as last seen, and its object id when recorded. */
type RecordEnd = SwitchShelveRecord['target'];

/**
 * Where the workspace is (`selector`), with its object id when it's known for free: a changeset is its own; a branch's is
 * the one the window already read (`known`), while it is still that branch, or else the one of the branches the records
 * name (`refs`) that the names already read (`nameOf`, `BranchNamesCache`) give the workspace's branch name.
 */
export function workspaceSpot(selector: WorkspaceSelector, { known, refs = [], nameOf = () => undefined }: { known?: KnownBranch; refs?: string[]; nameOf?: (branchId: number) => string | undefined }): WorkspaceSpot {
  const objectRef = objectRefOf(selector, known, refs, nameOf);
  return { ...selectorPlace(selector), ...(objectRef && { objectRef }) };
}

function objectRefOf(selector: WorkspaceSelector, known: KnownBranch | undefined, refs: string[], nameOf: (branchId: number) => string | undefined): string | undefined {
  if (selector.kind === 'changeset') return `cs:${selector.name}`;
  if (selector.kind !== 'branch') return undefined;
  if (known?.name === selector.name) return `br:${known.id}`;
  return refs.find((ref) => {
    const branchId = branchIdOf(ref);
    return branchId !== undefined && nameOf(branchId) === selector.name;
  });
}

/** The branch ids the records name (`br:37`), where their changes were made or went: whose names `workspaceSpot` looks for. */
export function branchRefsOf(records: SwitchShelveRecord[]): string[] {
  return records.flatMap((record) => [record.source.objectRef, record.target.objectRef ?? '']).filter((ref) => branchIdOf(ref) !== undefined);
}

function branchIdOf(objectRef: string): number | undefined {
  const match = /^br:(\d+)$/.exec(objectRef);
  return match ? Number(match[1]) : undefined;
}

/**
 * The record as its changes wait where the workspace is (`at`), if they do. Left changes wait where they were made.
 * Changes being brought wait on the target until their conflicts are resolved, and where they were made too, as left
 * there: the user went back instead.
 */
export function waitingOn(record: SwitchShelveRecord, at: WorkspaceSpot): LeftChangesRecord | undefined {
  if (!isLeftChanges(record)) return undefined;
  if (isAt(record.source, at)) return { ...record, mode: 'leave' };
  return record.mode === 'bring' && isAt(record.target, at) ? record : undefined;
}

/**
 * By id when both ends know theirs: a branch that took the name of the one the changes were left on is another branch.
 * By spec only when either id is unknown.
 */
function isAt(end: RecordEnd, at: WorkspaceSpot): boolean {
  if (end.objectRef && at.objectRef) return end.objectRef === at.objectRef;
  return end.spec === at.spec;
}

/**
 * The record with where its changes wait named as the workspace names it now (`at`): a branch it names by an id that is
 * now named otherwise was renamed. An end with no id yet (a target, a shelve adopted from another app) learns it from
 * its spec, so a later rename of it is followed too; an id held is never replaced. The same record when nothing changes.
 */
export function followingRenames(record: SwitchShelveRecord, at: WorkspaceSpot): SwitchShelveRecord {
  const source = followingRename(record.source, at);
  const target = followingRename(record.target, at);
  return source === record.source && target === record.target ? record : { ...record, source, target };
}

function followingRename<End extends RecordEnd>(end: End, at: WorkspaceSpot): End {
  if (!at.objectRef || !isAt(end, at)) return end;
  if (!end.objectRef) return { ...end, objectRef: at.objectRef };
  return end.spec === at.spec ? end : { ...end, spec: at.spec, name: at.name };
}

/**
 * The record's shelve among `shelves`, the automatic shelves of the repository the workspace is on (`repository`, as
 * named now). By its GUID once known: a renamed repository's shelve is still the record's. Until then by its number, in
 * the repository the record names.
 */
export function shelveOf(record: SwitchShelveRecord, shelves: Shelve[], repository: string): Shelve | undefined {
  if (record.shelveGuid) return shelves.find((shelve) => parseShelveGuid(shelve.guid) === record.shelveGuid);
  return record.repository === repository ? shelves.find((shelve) => shelve.id === record.shelveId) : undefined;
}

/**
 * The record of `shelve`, as found now: its number and the repository as named now, with the shelve's GUID, which finds
 * it after a rename of the repository. The same record when nothing changes.
 */
export function withShelve(record: SwitchShelveRecord, shelve: Shelve, repository: string): SwitchShelveRecord {
  const shelveGuid = parseShelveGuid(shelve.guid) ?? record.shelveGuid;
  if (record.shelveId === shelve.id && record.repository === repository && record.shelveGuid === shelveGuid) return record;
  return { ...record, shelveId: shelve.id, repository, ...(shelveGuid && { shelveGuid }) };
}

/** How "Welcome back" offers the changes of one of this app's records. */
export function toLeftChanges(record: LeftChangesRecord): LeftChanges {
  return {
    shelveId: record.shelveId,
    sourceName: record.source.name,
    targetName: record.target.name || undefined,
    mode: record.mode,
    reason: record.reason ?? 'switch',
    count: record.paths.length,
    createdAt: record.createdAt,
    foreign: false,
  };
}
