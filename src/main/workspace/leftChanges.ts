import { rm } from 'node:fs/promises';
import type { LeftChanges, RestoreResult, SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { Shelve } from '@shared/domain/shelve';
import { AUTOMATIC_SHELVE_CONDITION, automaticShelveComment } from '../cm/automaticShelve';
import type { CmClient } from '../cm/CmClient';
import { findRecords, toShelve } from '../cm/findObjects';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import { putBack } from './privateBackups';
import { selectorObjectRef } from './selectorObjectRef';
import { describeSelector, selectorSpec } from './switchSelectors';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { applyShelveCleanly, deleteShelves, detachReplacedFiles, readShelveEntries } from './switchShelves';
import { readWorkspaceIdentity, type WorkspaceIdentity } from './workspaceIdentity';

/**
 * The shelves left behind when switching away, found again when the workspace comes back:
 * this app's own records first, then the automatic shelves the official client or `cm switch` left
 * (they share the comment format, so the official lookup finds them).
 */
export class LeftChangesFinder {
  constructor(
    private readonly cm: CmClient,
    private readonly records: SwitchShelveRecords,
  ) {}

  async find(workspacePath: string): Promise<LeftChanges[]> {
    const workspace = await readWorkspaceIdentity(this.cm, workspacePath);
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
    const workspace = await readWorkspaceIdentity(this.cm, workspacePath);
    return this.records
      .forWorkspace(workspace.guid)
      .some((record) => record.repository === workspace.repository && waitingOn(record, selectorSpec(workspace.selector)));
  }

  /**
   * Applies the shelve if it merges cleanly, then puts the changelists back and deletes the shelve.
   * Shelves left by another app are adopted into the records, so finishing them in the merge view cleans up too.
   */
  async restore(workspacePath: string, shelveId: number, context: OperationContext): Promise<RestoreResult> {
    const workspace = await readWorkspaceIdentity(this.cm, workspacePath);
    const record = this.records.find({ shelveId, repository: workspace.repository }) ?? (await this.adopt(workspacePath, workspace, shelveId));

    if (record.backup) await putBack(workspacePath, record.backup);
    const outcome = await applyShelveCleanly(this.cm, workspacePath, shelveId, context);
    if (outcome.kind === 'pendingChanges') return { kind: 'pendingChanges' };
    if (outcome.kind === 'conflicts') return { kind: 'conflicts', shelveId };

    await this.finish(workspacePath, record);
    return { kind: 'restored', count: record.paths.length, sourceName: record.source.name };
  }

  /** After a merge from a shelve: if it was a switch shelve, its changes are back, so it is cleaned up. */
  async finishAppliedShelve(workspacePath: string, shelveId: number): Promise<void> {
    const workspace = await readWorkspaceIdentity(this.cm, workspacePath);
    const record = this.records.find({ shelveId, repository: workspace.repository });
    if (record) await this.finish(workspacePath, record);
  }

  async discard(workspacePath: string, shelveIds: number[]): Promise<void> {
    const workspace = await readWorkspaceIdentity(this.cm, workspacePath);
    const keys = shelveIds.map((shelveId) => ({ shelveId, repository: workspace.repository }));
    await deleteShelves(this.cm, workspacePath, keys.map(({ shelveId, repository }) => ({ id: shelveId, repository })));
    for (const key of keys) {
      const backup = this.records.find(key)?.backup;
      if (backup) await rm(backup.directory, { recursive: true, force: true });
    }
    this.records.remove(keys);
  }

  /** The changes are in the workspace again: back into their changelists, and the shelve and record go away. */
  async finish(workspacePath: string, record: SwitchShelveRecord): Promise<void> {
    if (record.backup) await putBack(workspacePath, record.backup);
    await detachReplacedFiles(this.cm, workspacePath);
    await this.restoreChangelists(workspacePath, record);
    await deleteShelves(this.cm, workspacePath, [{ id: record.shelveId, repository: record.repository }]);
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

  /** This workspace's records whose shelves still exist; the others were deleted elsewhere and are forgotten. */
  private liveRecords(workspace: WorkspaceIdentity, shelves: Shelve[]): SwitchShelveRecord[] {
    const existing = new Set(shelves.map((shelve) => shelve.id));
    const records = this.records.forWorkspace(workspace.guid).filter((record) => record.repository === workspace.repository);
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
    const record: SwitchShelveRecord = {
      workspaceGuid: workspace.guid,
      shelveId,
      repository: workspace.repository,
      source: {
        spec: selectorSpec(workspace.selector),
        name: describeSelector(workspace.selector),
        objectRef: (await selectorObjectRef(this.cm, workspacePath, workspace.selector)) ?? '',
      },
      target: { spec: '', name: '' },
      mode: 'leave',
      createdAt: new Date().toISOString(),
      paths: (await readShelveEntries(this.cm, workspacePath, shelveId)).map((entry) => entry.path),
      changelists: [],
    };
    this.records.save(record);
    return record;
  }
}

/**
 * The record as its changes wait on `spec`, if they do. Left changes wait where they were made. Changes being brought
 * wait on the target until their conflicts are resolved, and where they were made too, as left there: the user went
 * back instead.
 */
function waitingOn(record: SwitchShelveRecord, spec: string): SwitchShelveRecord | undefined {
  if (record.source.spec === spec) return { ...record, mode: 'leave' };
  return record.mode === 'bring' && record.target.spec === spec ? record : undefined;
}

function toLeftChanges(record: SwitchShelveRecord): LeftChanges {
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
