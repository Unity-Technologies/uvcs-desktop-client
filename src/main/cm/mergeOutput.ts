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

/** Separates fields in `cm merge --machinereadable` output. A control character never appears in paths. */
export const MERGE_FIELD_SEPARATOR = '\u001f';

/** A conflicting file as `cm merge` prints it: its ids and changesets, without the repository they belong to. */
type PrintedFileConflict = Omit<FileConflict, 'repository'>;

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

/** Parses the preview printed by `cm merge <spec> --machinereadable --printcontributors`. */
export function parseMergePlan(output: string): PrintedMergePlan {
  const plan: PrintedMergePlan = { status: 'ready', changes: [], fileConflicts: [], directoryConflicts: [], warnings: [] };
  const contributors: Partial<MergeContributors> = {};

  for (const line of output.split(/\r?\n/)) {
    const [record, ...fields] = line.split(MERGE_FIELD_SEPARATOR);
    switch (record) {
      case 'STATUS':
        plan.status = STATUSES[fields[0]!] ?? plan.status;
        if (!STATUSES[fields[0]!] && fields[1]) plan.warnings.push(fields[1]);
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

function byPath(a: { path: string }, b: { path: string }): number {
  return a.path.localeCompare(b.path);
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
 * each side's operation and its path (or its old and new paths for moves).
 */
function parseDirectoryConflict(fields: string[]): DirectoryConflict {
  const [type, title, explanation, sourceText, destinationText, itemId, isDirectory, ...sides] = fields;
  const [source, rest] = parseSide(sides, sourceText!);
  const [destination] = parseSide(rest, destinationText!);

  return {
    type: DIRECTORY_CONFLICT_TYPES[type!] ?? 'xlink',
    title: title!,
    explanation: explanation!,
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

/** Identifies a directory conflict across successive `cm merge` runs, which renumber the remaining ones. */
export function directoryConflictIdentity(conflict: DirectoryConflict): string {
  return [conflict.type, conflict.itemId, conflict.source.path, conflict.destination.path].join('|');
}

/** Parses `CHANGESET cs:12@/main/task@repo@server` from a merge into a server branch. */
export function parseCreatedChangeset(output: string): number | undefined {
  const created = /^CHANGESET\u001fcs:(\d+)@/m.exec(output);
  return created ? Number(created[1]) : undefined;
}

/**
 * `MERGE_NEEDED 12 /main repo server`, printed by a merge into a server branch that someone checked in on meanwhile:
 * the merge's changeset is left beside the new head, and has to be merged into the branch to finish.
 */
export function parseDestinationMoved(output: string): boolean {
  return /^MERGE_NEEDED\u001f/m.test(output);
}
