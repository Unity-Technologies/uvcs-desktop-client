import { rm } from 'node:fs/promises';
import type { Shelve, ShelveApplyResult } from '@shared/domain/shelve';
import { selectorSpec } from '@shared/domain/specs';
import type { KeptAsideFile, LeftChanges, RestoreResult, SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import type { OperationContext } from '../operations/OperationTracker';
import { applyShelveCleanly, type ApplyOutcome } from './applyShelveCleanly';
import { detachReplacedFiles } from './detachReplacedFiles';
import { readAutomaticShelves, shelvesLeftOn, toForeignLeftChanges } from './foreignLeftChanges';
import { isLeftChanges, toLeftChanges, waitingOn } from './leftChangesRecords';
import { putBack } from './privateBackups';
import { restoreChangelists } from './restoreChangelists';
import { selectorObjectRef } from './selectorObjectRef';
import { newShelveRecord, NO_TARGET } from './shelveRecord';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { deleteShelves, readShelveEntries } from './verifiedShelve';
import { readWorkspaceIdentity, type WorkspaceIdentity } from './workspaceIdentity';
import { cmHeaderReaders, type HeaderReaders } from './WorkspaceHeaders';

/**
 * The shelves left behind when switching away, found again when the workspace comes back:
 * this app's own records first, then the automatic shelves the official client or `cm switch` left
 * (they share the comment format, so the official lookup finds them). It also puts any recorded shelve's changes back
 * (restore, apply) and forgets them (discard, finish). Files moved aside that can't go back stay in the app's data
 * folder, and it tells (`tellKeptAside`).
 */
export class LeftChangesFinder {
  constructor(
    private readonly cm: CmClient,
    private readonly records: SwitchShelveRecords,
    private readonly headers: HeaderReaders = cmHeaderReaders(cm),
    private readonly tellKeptAside: (workspacePath: string, files: KeptAsideFile[]) => void = () => {},
  ) {}

  async find(workspacePath: string): Promise<LeftChanges[]> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const shelves = await readAutomaticShelves(this.cm, workspacePath);
    const own = this.liveRecords(workspace, shelves).flatMap((record) => waitingOn(record, selectorSpec(workspace.selector)) ?? []);
    const unrecorded = shelves.filter((shelve) => !this.records.find({ shelveId: shelve.id, repository: workspace.repository }));
    const foreign = await shelvesLeftOn(this.cm, workspacePath, workspace.selector, unrecorded);

    return [
      ...own.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toLeftChanges),
      ...(await Promise.all(foreign.map((shelve) => toForeignLeftChanges(this.cm, workspacePath, workspace.selector, shelve)))),
    ];
  }

  /** Whether this app's records have changes waiting on what the workspace is on now. Reads no server data. */
  async hasOwnWaiting(workspacePath: string): Promise<boolean> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    return this.records
      .forWorkspace(workspace.guid)
      .some((record) => record.repository === workspace.repository && waitingOn(record, selectorSpec(workspace.selector)));
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

  /** Deletes the shelves, the files their records moved aside, and the records. */
  async discard(workspacePath: string, shelveIds: number[]): Promise<void> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const keys = shelveIds.map((shelveId) => ({ shelveId, repository: workspace.repository }));
    await deleteShelves(this.cm, workspacePath, keys.map(({ shelveId, repository }) => ({ id: shelveId, repository })));
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
    if (deleteShelve) await deleteShelves(this.cm, workspacePath, [{ id: record.shelveId, repository: record.repository }]);
    this.records.remove([record]);
  }

  /** Puts back the files the record moved aside, then merges the shelve when nothing conflicts. */
  private async applyRecorded(workspacePath: string, shelveId: number, record: SwitchShelveRecord | undefined, context: OperationContext): Promise<ApplyOutcome> {
    if (record?.backup) await putBack(workspacePath, record.backup);
    return applyShelveCleanly(this.cm, workspacePath, shelveId, context);
  }

  private async finishApplied(workspacePath: string, workspace: WorkspaceIdentity, shelveId: number, deleteShelve: boolean): Promise<void> {
    const record = this.ownRecord(workspace, shelveId);
    if (record) return this.finish(workspacePath, record, deleteShelve || record.reason !== 'shelve');
    await detachReplacedFiles(this.cm, workspacePath);
    if (deleteShelve) await deleteShelves(this.cm, workspacePath, [{ id: shelveId, repository: workspace.repository }]);
  }

  /** The record of a shelve this workspace made: another workspace's backup and changelists aren't this one's. */
  private ownRecord(workspace: WorkspaceIdentity, shelveId: number): SwitchShelveRecord | undefined {
    const record = this.records.find({ shelveId, repository: workspace.repository });
    return record?.workspaceGuid === workspace.guid ? record : undefined;
  }

  /**
   * This workspace's records of left changes whose shelves still exist; the others were deleted elsewhere and are
   * forgotten. Shelves the user shelved away carry the user's comment, not the automatic one: they aren't in `shelves`.
   */
  private liveRecords(workspace: WorkspaceIdentity, shelves: Shelve[]): SwitchShelveRecord[] {
    const existing = new Set(shelves.map((shelve) => shelve.id));
    const records = this.records.forWorkspace(workspace.guid).filter((record) => record.repository === workspace.repository && isLeftChanges(record));
    const gone = records.filter((record) => !existing.has(record.shelveId));
    if (gone.length > 0) this.records.remove(gone);
    return records.filter((record) => existing.has(record.shelveId));
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
