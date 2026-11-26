import { rm } from 'node:fs/promises';
import type { KnownBranch } from '@shared/domain/branch';
import type { Place } from '@shared/domain/place';
import type { Shelve, ShelveApplyResult } from '@shared/domain/shelve';
import type { KeptAsideFile, LeftChanges, RestoreResult, SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { cmPlace } from '../cm/cmPlace';
import type { CmClient } from '../cm/CmClient';
import type { OperationContext } from '../operations/OperationTracker';
import { applyShelveCleanly, type ApplyOutcome } from './applyShelveCleanly';
import { detachReplacedFiles } from './detachReplacedFiles';
import { readAutomaticShelves, shelvesLeftOn, toForeignLeftChanges } from './foreignLeftChanges';
import { branchRefsOf, followingRenames, isLeftChanges, shelveOf, toLeftChanges, waitingOn, withShelve, workspaceSpot, type LeftChangesRecord, type WorkspaceSpot } from './leftChangesRecords';
import { kindFromHeaders } from './shelveFlowDependencies';
import { putBack } from './privateBackups';
import { restoreChangelists } from './restoreChangelists';
import { selectorObjectRef } from './selectorObjectRef';
import { newShelveRecord, NO_TARGET } from './shelveRecord';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { deleteShelves, readShelveEntries } from './verifiedShelve';
import { readWorkspaceIdentity, type WorkspaceIdentity } from './workspaceIdentity';
import { cmHeaderReaders, type HeaderReaders } from './WorkspaceHeaders';

/** A branch's name as a list already read it (`BranchNamesCache.knownName`), without asking the server. */
export type KnownBranchName = (workspacePath: string, branchId: number) => string | undefined;

/**
 * The shelves left behind when switching away, found again when the workspace comes back:
 * this app's own records first, then the automatic shelves the official client or `cm switch` left
 * (they share the comment format, so the official lookup finds them). It also puts any recorded shelve's changes back
 * (restore, apply) and forgets them (discard, finish). Files moved aside that can't go back stay in the app's data
 * folder, and it tells (`tellKeptAside`).
 *
 * Records survive renames: a record is the workspace's by its GUID, waits on a branch by its object id as well as its
 * name, and finds its shelve by the shelve's GUID once listed, whatever its repository is called now. What a rename
 * changed is written back to the record as `find` sees it (`followingRenames`, `withShelve`).
 */
export class LeftChangesFinder {
  constructor(
    private readonly cm: CmClient,
    private readonly records: SwitchShelveRecords,
    private readonly headers: HeaderReaders = cmHeaderReaders(cm),
    private readonly tellKeptAside: (workspacePath: string, files: KeptAsideFile[]) => void = () => {},
    private readonly knownBranchName: KnownBranchName = () => undefined,
  ) {}

  /** `branch`: the workspace's branch as the window already read it (`LeftChangesApi.find`). */
  async find(workspacePath: string, branch?: KnownBranch): Promise<LeftChanges[]> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const shelves = await readAutomaticShelves(this.cm, workspacePath);
    const kept = this.records.forWorkspace(workspace.guid).filter(isLeftChanges);
    const at = this.spotOf(workspacePath, workspace, kept, branch);
    const own = this.liveRecords(kept, workspace, shelves, at).flatMap((record) => waitingOn(record, at) ?? []);
    const unrecorded = shelves.filter((shelve) => !this.records.find({ shelveId: shelve.id, repository: workspace.repository }));
    const foreign = await shelvesLeftOn(this.cm, workspacePath, workspace.selector, unrecorded, branch);

    return [
      ...own.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toLeftChanges),
      ...(await Promise.all(foreign.map((shelve) => toForeignLeftChanges(this.cm, workspacePath, workspace.selector, shelve)))),
    ];
  }

  /**
   * Whether this app's records have changes waiting on what the workspace is on now. Reads no server data: a branch
   * renamed since is told by the names lists already read (`knownBranchName`). A record whose shelve's GUID is known
   * may be of a repository renamed since, which `find` tells by that GUID; one without is compared by its repository's
   * name, as no rename could have been followed for it.
   */
  async hasOwnWaiting(workspacePath: string): Promise<boolean> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const records = this.records.forWorkspace(workspace.guid).filter((record) => isLeftChanges(record) && (record.shelveGuid || record.repository === workspace.repository));
    const at = this.spotOf(workspacePath, workspace, records);
    return records.some((record) => waitingOn(record, at));
  }

  /**
   * Applies the shelve if it merges cleanly, then puts the changelists back and deletes the shelve.
   * Shelves left by another app are adopted into the records, so finishing them in the merge view cleans up too.
   */
  async restore(workspacePath: string, shelveId: number, context: OperationContext): Promise<RestoreResult> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const record = this.records.find({ shelveId, repository: workspace.repository }) ?? (await this.adopt(workspacePath, workspace, shelveId));

    const outcome = await this.applyRecorded(workspacePath, shelveId, record, context);
    if (outcome.kind === 'pendingChanges') return { kind: 'pendingChanges' };
    if (outcome.kind === 'conflicts') return { kind: 'conflicts', shelveId };

    await this.finish(workspacePath, record);
    return { kind: 'restored', count: record.paths.length, sourceName: record.source.name };
  }

  /**
   * Applies any shelve to the workspace when it merges cleanly. What shelving it away took from here (the added files
   * moved aside, the changelists) comes back as when restoring left changes; the shelve is deleted if asked, and always
   * when it held changes left by a switch or an update: those are done once back.
   */
  async apply(workspacePath: string, shelveId: number, deleteShelve: boolean, context: OperationContext): Promise<ShelveApplyResult> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);

    const outcome = await this.applyRecorded(workspacePath, shelveId, this.ownRecord(workspace, shelveId), context);
    if (outcome.kind === 'pendingChanges') return { kind: 'pendingChanges' };
    if (outcome.kind === 'conflicts') return { kind: 'conflicts' };

    await this.finishApplied(workspacePath, workspace, shelveId, deleteShelve);
    return { kind: 'applied', count: outcome.count };
  }

  /** After a merge from a shelve (its conflicts resolved in the merge view): cleaned up as `apply` does. */
  async finishAppliedShelve(workspacePath: string, shelveId: number, deleteShelve: boolean): Promise<void> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    await this.finishApplied(workspacePath, workspace, shelveId, deleteShelve);
  }

  /**
   * Deletes the shelves of the place's repository, the files their records moved aside, and the records: a record is
   * the repository's, so deleting one of its shelves from a window with no workspace forgets it too.
   */
  async discard(place: Place, shelveIds: number[]): Promise<void> {
    const repository = place.kind === 'repository' ? place.repository : (await readWorkspaceIdentity(this.headers, place.workspacePath)).repository;
    const keys = shelveIds.map((shelveId) => ({ shelveId, repository }));
    await deleteShelves(this.cm, cmPlace(place).options, keys.map(({ shelveId }) => ({ id: shelveId, repository })));
    for (const key of keys) {
      const backup = this.records.find(key)?.backup;
      if (backup) await rm(backup.directory, { recursive: true, force: true, maxRetries: 5 });
    }
    this.records.remove(keys);
  }

  /**
   * The changes are in the workspace again: back into their changelists, and the record (and the shelve, unless kept)
   * go away. A file moved aside that another item took the place of meanwhile stays in the backup, and is told.
   */
  async finish(workspacePath: string, record: SwitchShelveRecord, deleteShelve = true): Promise<void> {
    if (record.backup) {
      const kept = await putBack(workspacePath, record.backup);
      if (kept.length > 0) this.tellKeptAside(workspacePath, kept);
    }
    // Kept or not: a file still on the shelve's revision diffs against it, showing no change at all.
    await detachReplacedFiles(this.cm, workspacePath);
    await restoreChangelists(this.cm, workspacePath, record.changelists);
    if (deleteShelve) await deleteShelves(this.cm, { cwd: workspacePath }, [{ id: record.shelveId, repository: record.repository }]);
    this.records.remove([record]);
  }

  /** Puts back the files the record moved aside, then merges the shelve when nothing conflicts. */
  private async applyRecorded(workspacePath: string, shelveId: number, record: SwitchShelveRecord | undefined, context: OperationContext): Promise<ApplyOutcome> {
    if (record?.backup) await putBack(workspacePath, record.backup);
    return applyShelveCleanly(this.cm, workspacePath, shelveId, await kindFromHeaders(this.headers)(workspacePath), context);
  }

  private async finishApplied(workspacePath: string, workspace: WorkspaceIdentity, shelveId: number, deleteShelve: boolean): Promise<void> {
    const record = this.ownRecord(workspace, shelveId);
    if (record) return this.finish(workspacePath, record, deleteShelve || record.reason !== 'shelve');
    await detachReplacedFiles(this.cm, workspacePath);
    if (deleteShelve) await deleteShelves(this.cm, { cwd: workspacePath }, [{ id: shelveId, repository: workspace.repository }]);
  }

  /** The record of a shelve this workspace made: another workspace's backup and changelists aren't this one's. */
  private ownRecord(workspace: WorkspaceIdentity, shelveId: number): SwitchShelveRecord | undefined {
    const record = this.records.find({ shelveId, repository: workspace.repository });
    return record?.workspaceGuid === workspace.guid ? record : undefined;
  }

  /** Where the workspace is, by its spec and, when known for free, its object id (`workspaceSpot`). */
  private spotOf(workspacePath: string, workspace: WorkspaceIdentity, records: SwitchShelveRecord[], known?: KnownBranch): WorkspaceSpot {
    const nameOf = (branchId: number): string | undefined => this.knownBranchName(workspacePath, branchId);
    return workspaceSpot(workspace.selector, { known, refs: branchRefsOf(records), nameOf });
  }

  /**
   * The records (this workspace's, of left changes) whose shelves are in its repository's `shelves`, named as they are
   * where the workspace is (`at`); those of the repository whose shelves are gone were deleted elsewhere and are
   * forgotten. A record of another repository the workspace switched away from stays. Shelves the user shelved away
   * carry the user's comment, not the automatic one: they aren't in `shelves`.
   */
  private liveRecords(records: LeftChangesRecord[], workspace: WorkspaceIdentity, shelves: Shelve[], at: WorkspaceSpot): SwitchShelveRecord[] {
    const found = records.map((record) => ({ kept: record, shelve: shelveOf(record, shelves, workspace.repository) }));
    const gone = found.filter(({ kept, shelve }) => !shelve && kept.repository === workspace.repository).map(({ kept }) => kept);
    if (gone.length > 0) this.records.remove(gone);
    const live = found.flatMap(({ kept, shelve }) => (shelve ? [{ kept, now: followingRenames(withShelve(kept, shelve, workspace.repository), at) }] : []));
    this.records.replace(live.filter(({ kept, now }) => kept !== now));
    return live.map(({ now }) => now);
  }

  /** Records a shelve another app left here, as if this app had left it, so finishing it cleans up the same way. */
  private async adopt(workspacePath: string, workspace: WorkspaceIdentity, shelveId: number): Promise<SwitchShelveRecord> {
    const objectRef = (await selectorObjectRef(this.cm, workspacePath, workspace.selector)) ?? '';
    const paths = (await readShelveEntries(this.cm, workspacePath, shelveId)).map((entry) => entry.path);
    const record = newShelveRecord(workspace, shelveId, { paths, changelists: [] }, { mode: 'leave', objectRef, target: NO_TARGET });
    this.records.save(record);
    return record;
  }
}
