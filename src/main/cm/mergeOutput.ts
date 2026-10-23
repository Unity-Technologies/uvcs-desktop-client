import type {
  ConflictSide,
  DirectoryConflict,
  DirectoryConflictType,
  FileConflict,
  ItemOperation,
  MergeChange,
  MergeContributor,
  MergeContributors,
  MergePlan,
  MergePlanStatus,
} from '@shared/domain/merge';
import { comparePaths } from '@shared/pathOrder';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './formatRecords';
import { directoryConflictWords } from './directoryConflictWords';

/** Separates fields in `cm merge --machinereadable` output. */
export const MERGE_FIELD_SEPARATOR = FIELD_SEPARATOR;

/**
 * Ends each record of the preview (`cm merge --machinereadable --endlineseparator`), so its records are read as they
 * arrive (`queryRecords`, `readFields`): a merge of a big branch lists every file it changes.
 */
export const MERGE_PREVIEW_RECORD_ARGS = [`--endlineseparator=${RECORD_SEPARATOR}`];

/**
 * A conflicting file as `cm merge` prints it: its ids and changesets, without the repository they belong to nor the
 * destination's revision and its type.
 */
type PrintedFileConflict = Omit<FileConflict, 'repository' | 'destinationRevisionId' | 'destinationIsBinary'>;

/** The plan as `cm merge` prints it; `withConflictRepositories` completes its file conflicts. */
export type PrintedMergePlan = Omit<MergePlan, 'fileConflicts'> & { fileConflicts: PrintedFileConflict[] };

const DIRECTORY_CONFLICT_TYPES: Record<string, DirectoryConflictType> = {
  EVIL: 'evilTwin',
  MV_EVIL: 'movedEvilTwin',
  CHG_RM: 'changeDelete',
  RM_CHG: 'deleteChange',
  MV_RM: 'moveDelete',
  RM_MV: 'deleteMove',
  DIV_MV: 'divergentMove',
  CYCLE: 'cycleMove',
  TWICE: 'loadedTwice',
  ADD_MV: 'addMove',
  MV_ADD: 'moveAdd',
  XLINK: 'xlink',
};

const ITEM_OPERATIONS: Record<string, ItemOperation> = {
  ADD: 'added',
  RM: 'deleted',
  MV: 'moved',
  CHG: 'changed',
};

const STATUSES: Record<string, MergePlanStatus> = {
  ALREADY_CONNECTED: 'alreadyMerged',
  NO_MERGES_DETECTED: 'alreadyMerged',
  INVALID_INTERVAL: 'invalidInterval',
};

/**
 * The plan of the records `cm merge <spec> --machinereadable --printcontributors` printed, each its fields: the preview's
 * (`MERGE_PREVIEW_RECORD_ARGS`), or those a merge run kept (`mergeOutcomeRecordOf`).
 */
export function mergePlanOf(records: readonly string[][]): PrintedMergePlan {
  const plan: PrintedMergePlan = { status: 'ready', changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] };
  const contributors: Partial<MergeContributors> = {};

  for (const [record, ...fields] of records) {
    switch (record) {
      case 'STATUS':
        readStatus(plan, fields);
        break;
      case 'CONTRIBUTOR':
        addContributor(contributors, fields);
        break;
      case 'DIR_CONFLICT':
        plan.directoryConflicts.push(parseDirectoryConflict(fields));
        break;
      case 'FILE_CONFLICT':
        plan.fileConflicts.push(parseFileConflict(fields));
        break;
      case 'FILE_SRC':
        plan.changes.push({ kind: 'changed', path: fields[0]! });
        break;
      case 'APPLY':
        plan.changes.push(parseChangeToApply(fields));
        break;
      // Deletes on both sides (RM_RM_WARN) and changes already on the destination (DIS_OP_WARN) need no attention.
      case 'PATH_CONFLICT_WARN':
        plan.warnings.push(`${fields[0]} will be renamed to ${fields[1]} to avoid a name clash.`);
        break;
    }
  }

  if (contributors.source && contributors.destination) plan.contributors = contributors as MergeContributors;
  // `cm` lists files in no order a person would look for them; directory conflicts keep theirs, which resolving goes by.
  plan.fileConflicts.sort(byPath);
  plan.changes.sort(byPath);
  return plan;
}

/** A status the plan knows (already merged, an invalid interval) sets it; any other is a warning, when it says why. */
function readStatus(plan: PrintedMergePlan, [code = '', message]: string[]): void {
  const status = STATUSES[code];
  if (status) plan.status = status;
  else if (message) plan.warnings.push(message);
}

function byPath(a: { path: string }, b: { path: string }): number {
  return comparePaths(a.path, b.path);
}

function addContributor(contributors: Partial<MergeContributors>, [role, changesetId, , branch]: string[]): void {
  const contributor: MergeContributor = { changesetId: Number(changesetId), branch: branch ?? '' };
  if (role === 'SRC') contributors.source = contributor;
  else if (role === 'DST') contributors.destination = contributor;
  else if (role === 'BASE') contributors.base ??= contributor;
}

function parseFileConflict([path, base, source, destination, itemId]: string[]): PrintedFileConflict {
  return {
    path: path!,
    baseChangeset: Number(base),
    sourceChangeset: Number(source),
    destinationChangeset: Number(destination),
    itemId: Number(itemId),
  };
}

function parseChangeToApply([operation, path, destinationPath]: string[]): MergeChange {
  switch (operation) {
    case 'ADD':
      return { kind: 'added', path: path! };
    case 'RM':
      return { kind: 'deleted', path: path! };
    case 'MV':
      return { kind: 'moved', path: destinationPath!, oldPath: path };
    default:
      return { kind: 'permissions', path: path! };
  }
}

/**
 * `TYPE, title, explanation, source text, destination text, item id, is directory`, followed by
 * each side's operation and its path (or its old and new paths for moves). `cm`'s title and explanation give way to
 * plain words (`directoryConflictWords`).
 */
function parseDirectoryConflict(fields: string[]): DirectoryConflict {
  const [type, title, explanation, sourceText, destinationText, itemId, isDirectory, ...sides] = fields;
  const [source, rest] = parseSide(sides, sourceText!);
  const [destination] = parseSide(rest, destinationText!);
  const conflictType = DIRECTORY_CONFLICT_TYPES[type!] ?? 'xlink';

  return {
    type: conflictType,
    ...directoryConflictWords(conflictType, title!, explanation!),
    itemId: Number(itemId),
    isDirectory: isDirectory === 'True',
    source,
    destination,
  };
}

function parseSide([operationCode, firstPath, ...rest]: string[], description: string): [ConflictSide, string[]] {
  const operation = ITEM_OPERATIONS[operationCode!] ?? 'changed';
  if (operation === 'moved') {
    const [newPath, ...remaining] = rest;
    return [{ operation, path: newPath!, oldPath: firstPath, description }, remaining];
  }
  return [{ operation, path: firstPath!, description }, rest];
}

/** The records of a merge run that tell how it ended: the directory conflicts left, the changeset made, a moved destination. */
const OUTCOME_RECORDS = new Set(['DIR_CONFLICT', 'CHANGESET', 'MERGE_NEEDED']);

/**
 * The fields of a line a merge run printed, when it's a record that tells how it ended: a run is read by its lines as
 * they arrive (`onOutputLine`), and only these are kept, as it prints a line for each file it merges.
 */
export function mergeOutcomeRecordOf(line: string): string[] | undefined {
  const fields = line.split(MERGE_FIELD_SEPARATOR);
  return OUTCOME_RECORDS.has(fields[0] ?? '') ? fields : undefined;
}

const CREATED_CHANGESET = /^cs:(\d+)@/;

/** The changeset `CHANGESET cs:12@/main/task@repo@server` names, printed by a merge into a server branch. */
export function createdChangesetOf(records: readonly string[][]): number | undefined {
  for (const [record, spec = ''] of records) {
    const created = record === 'CHANGESET' ? CREATED_CHANGESET.exec(spec) : null;
    if (created) return Number(created[1]);
  }
  return undefined;
}

/**
 * `MERGE_NEEDED 12 /main repo server`, printed by a merge into a server branch that someone checked in on meanwhile:
 * the merge's changeset is left beside the new head, and has to be merged into the branch to finish.
 */
export function destinationMovedIn(records: readonly string[][]): boolean {
  return records.some(([record]) => record === 'MERGE_NEEDED');
}
