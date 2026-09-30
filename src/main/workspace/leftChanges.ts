import { rm } from 'node:fs/promises';
import { selectorSpec } from '@shared/domain/specs';
import type { LeftChanges, RestoreResult, SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { Shelve, ShelveApplyResult } from '@shared/domain/shelve';
import { AUTOMATIC_SHELVE_CONDITION, automaticShelveComment } from '../cm/automaticShelve';
import type { CmClient } from '../cm/CmClient';
import { findRecords, toShelve } from '../cm/findObjects';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import { applyShelveCleanly } from './applyShelveCleanly';
import { detachReplacedFiles } from './detachReplacedFiles';
import { putBack } from './privateBackups';
import { selectorObjectRef } from './selectorObjectRef';
import { newShelveRecord, NO_TARGET } from './shelveRecord';
import { describeSelector } from './switchSelectors';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { deleteShelves, readShelveEntries } from './verifiedShelve';
import { readWorkspaceIdentity, type WorkspaceIdentity } from './workspaceIdentity';
import { cmHeaderReaders, type HeaderReaders } from './WorkspaceHeaders';

/**
 * The shelves left behind when switching away, found again when the workspace comes back:
 * this app's own records first, then the automatic shelves the official client or `cm switch` left
 * (they share the comment format, so the official lookup finds them).
 */
export class LeftChangesFinder {
  constructor(
    private readonly cm: CmClient,
    private readonly records: SwitchShelveRecords,
    private readonly headers: HeaderReaders = cmHeaderReaders(cm),
  ) {}

  async find(workspacePath: string): Promise<LeftChanges[]> {
    const workspace = await readWorkspaceIdentity(this.headers, workspacePath);
    const shelves = await this.automaticShelves(workspacePath);
    const own = this.liveRecords(workspace, shelves).flatMap((record) => waitingOn(record, selectorSpec(workspace.selector)) ?? []);
    const foreign = await this.foreignShelves(workspacePath, workspace, shelves);

    return [
      ...own.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toLeftChanges),
      ...(await Promise.all(foreign.map(async (shelve) => this.toForeignLeftChanges(workspacePath, workspace, shelve)))),
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

    if (record.backup) await putBack(workspacePath, record.backup);
    const outcome = await applyShelveCleanly(this.cm, workspacePath, shelveId, context);
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
    const record = this.ownRecord(workspace, shelveId);

    if (record?.backup) await putBack(workspacePath, record.backup);
    const outcome = await applyShelveCleanly(this.cm, workspacePath, shelveId, context);
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

  /** The changes are in the workspace again: back into their changelists, and the record (and the shelve, unless kept) go away. */
  async finish(workspacePath: string, record: SwitchShelveRecord, deleteShelve = true): Promise<void> {
    if (record.backup) await putBack(workspacePath, record.backup);
    // Kept or not: a file still on the shelve's revision diffs against it, showing no change at all.
    await detachReplacedFiles(this.cm, workspacePath);
    await this.restoreChangelists(workspacePath, record);
    if (deleteShelve) await deleteShelves(this.cm, workspacePath, [{ id: record.shelveId, repository: record.repository }]);
    this.records.remove([record]);
  }

  private async restoreChangelists(workspacePath: string, record: SwitchShelveRecord): Promise<void> {
    for (const changelist of record.changelists) {
      await this.cm.query(['changelist', 'create', changelist.name, changelist.description, '--persistent'], { cwd: workspacePath }).catch(() => {
        // It still exists: changelists outlive their changes.
      });
      const paths = changelist.paths.map((path) => toAbsolutePath(workspacePath, path));
      await this.cm.query(['changelist', changelist.name, 'add', ...paths], { cwd: workspacePath }).catch(() => {
        // Some paths may not be pending anymore (the user resolved them differently); the rest stay in the default changelist.
      });
    }
  }

  private async automaticShelves(workspacePath: string): Promise<Shelve[]> {
    const xml = await this.cm.query(['find', 'shelve', `where owner = 'me' and ${AUTOMATIC_SHELVE_CONDITION}`, '--xml', '--nototal'], { cwd: workspacePath });
    return findRecords(xml, 'SHELVE').map(toShelve);
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

  /** Automatic shelves left on the current selector by another app or workspace (the ones this app recorded are its own). */
  private async foreignShelves(workspacePath: string, workspace: WorkspaceIdentity, shelves: Shelve[]): Promise<Shelve[]> {
    const unrecorded = shelves.filter((shelve) => !this.records.find({ shelveId: shelve.id, repository: workspace.repository }));
    // Without such shelves there is nothing to match: the selector's object id would cost a server lookup for nothing.
    if (unrecorded.length === 0) return [];
    const objectRef = await selectorObjectRef(this.cm, workspacePath, workspace.selector);
    if (!objectRef) return [];
    const comment = automaticShelveComment(objectRef);
    return unrecorded.filter((shelve) => shelve.comment === comment).sort((a, b) => b.id - a.id);
  }

  private async toForeignLeftChanges(workspacePath: string, workspace: WorkspaceIdentity, shelve: Shelve): Promise<LeftChanges> {
    return {
      shelveId: shelve.id,
      sourceName: describeSelector(workspace.selector),
      mode: 'leave',
      reason: 'switch',
      count: (await readShelveEntries(this.cm, workspacePath, shelve.id)).length,
      createdAt: shelve.date,
      foreign: true,
    };
  }

  private async adopt(workspacePath: string, workspace: WorkspaceIdentity, shelveId: number): Promise<SwitchShelveRecord> {
    const objectRef = (await selectorObjectRef(this.cm, workspacePath, workspace.selector)) ?? '';
    const paths = (await readShelveEntries(this.cm, workspacePath, shelveId)).map((entry) => entry.path);
    const record = newShelveRecord(workspace, shelveId, { paths, changelists: [] }, { mode: 'leave', objectRef, target: NO_TARGET });
    this.records.save(record);
    return record;
  }
}

/**
 * The record as its changes wait on `spec`, if they do. Left changes wait where they were made. Changes being brought
 * wait on the target until their conflicts are resolved, and where they were made too, as left there: the user went
 * back instead.
 */
function waitingOn(record: SwitchShelveRecord, spec: string): LeftChangesRecord | undefined {
  if (!isLeftChanges(record)) return undefined;
  if (record.source.spec === spec) return { ...record, mode: 'leave' };
  return record.mode === 'bring' && record.target.spec === spec ? record : undefined;
}

type LeftChangesRecord = SwitchShelveRecord & { reason?: LeftChanges['reason'] };

/** Shelved by the app to switch or update, not by the user: only these are "Welcome back"'s, and restored on arrival. */
function isLeftChanges(record: SwitchShelveRecord): record is LeftChangesRecord {
  return record.reason !== 'shelve';
}

function toLeftChanges(record: LeftChangesRecord): LeftChanges {
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
