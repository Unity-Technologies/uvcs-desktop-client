import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry } from '@shared/domain/diff';
import type { IncomingChanges, IncomingSummary, LoadedBranch, UpdateConflict } from '@shared/domain/incoming';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { findRecords, toChangeset } from '../cm/findObjects';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readWorkspaceStatus } from '../cm/workspaceStatus';

const LOCAL_CONTENT_CHANGES = new Set(['changed', 'checkedOut', 'replaced']);

/**
 * How many changesets the branch has after the loaded one, and by whom. Polled, so it is a single `cm find` returning
 * only changeset numbers and owners; the renderer tells where the workspace stands (its workspace info follows `.plastic`).
 */
export async function readIncomingSummary(cm: CmClient, workspacePath: string, { branch, loadedChangeset }: LoadedBranch): Promise<IncomingSummary> {
  if (!branch) return { branch: null, loadedChangeset, headChangeset: loadedChangeset, changesetCount: 0, authors: [] };
  const output = await cm.query(incomingChangesetsArgs(branch, loadedChangeset), { cwd: workspacePath });
  return summarizeIncoming(branch, loadedChangeset, parseRecords(output).map(([id, owner]) => ({ id: Number(id), owner: owner ?? '' })));
}

export function incomingChangesetsArgs(branch: string, loadedChangeset: number): string[] {
  return [
    'find',
    'changeset',
    `where changesetid > ${loadedChangeset} and branch = '${escapeQueryValue(branch)}'`,
    `--format=${recordFormat(['changesetid', 'owner'])}`,
    '--nototal',
  ];
}

export function summarizeIncoming(branch: string, loadedChangeset: number, incoming: { id: number; owner: string }[]): IncomingSummary {
  const newestFirst = [...incoming].sort((a, b) => b.id - a.id);
  return {
    branch,
    loadedChangeset,
    headChangeset: newestFirst[0]?.id ?? loadedChangeset,
    changesetCount: incoming.length,
    authors: distinctAuthors(newestFirst.map((changeset) => changeset.owner)),
  };
}

function distinctAuthors(owners: string[]): string[] {
  return [...new Set(owners.filter(Boolean))];
}

export async function readIncomingChanges(cm: CmClient, workspacePath: string): Promise<IncomingChanges> {
  const { summary, changesets } = await readIncomingChangesets(cm, workspacePath);
  if (changesets.length === 0) return { ...summary, changesets, files: [], conflicts: [], blockedPaths: [] };

  const [diffOutput, statusXml] = await Promise.all([
    cm.query(['diff', spec.changeset(summary.loadedChangeset), spec.changeset(summary.headChangeset), '--repositorypaths', `--format=${DIFF_FORMAT}`], {
      cwd: workspacePath,
    }),
    cm.query(['status', '--xml', '--controlledchanged', '--changed'], { cwd: workspacePath }),
  ]);
  const files = parseDiffEntries(diffOutput);
  const local = parsePendingChanges(statusXml).changes;

  return { ...summary, changesets, files, conflicts: findUpdateConflicts(files, local), blockedPaths: findUpdateBlockers(files, local) };
}

/** Local changes to items the branch deleted or moved away: updating can't merge them. */
export function findUpdateBlockers(incoming: DiffEntry[], local: PendingChange[]): string[] {
  const localPaths = new Set(local.map((change) => change.path));
  return incoming
    .filter((entry) => entry.status === 'deleted' || entry.status === 'moved')
    .map((entry) => entry.oldPath ?? entry.path)
    .filter((path) => localPaths.has(path));
}

/** Files whose content changed both locally and on the branch: updating has to merge them. */
export function findUpdateConflicts(incoming: DiffEntry[], local: PendingChange[]): UpdateConflict[] {
  const locallyChanged = new Set(
    local.filter((change) => change.kinds.some((kind) => LOCAL_CONTENT_CHANGES.has(kind))).map((change) => change.path),
  );

  return incoming
    .filter((entry) => entry.status === 'changed' && entry.itemType !== 'directory' && locallyChanged.has(entry.path))
    .map((entry) => ({
      path: entry.path,
      isBinary: entry.itemType === 'binaryFile',
      baseRevisionId: entry.baseRevisionId,
      incomingRevisionId: entry.revisionId,
      repository: entry.repository,
    }));
}

async function readIncomingChangesets(cm: CmClient, workspacePath: string): Promise<{ summary: IncomingSummary; changesets: Changeset[] }> {
  const status = await readWorkspaceStatus(cm, workspacePath);
  const loadedChangeset = status.loadedChangeset;
  if (status.selector.kind !== 'branch') {
    return { summary: { branch: null, loadedChangeset, headChangeset: loadedChangeset, changesetCount: 0, authors: [] }, changesets: [] };
  }

  const branch = status.selector.name;
  const xml = await cm.query(findArgs('changeset', { branch }, 'changesetid desc', [`changesetid > ${loadedChangeset}`]), { cwd: workspacePath });
  const changesets = findRecords(xml, 'CHANGESET').map(toChangeset);

  return {
    summary: {
      branch,
      loadedChangeset,
      headChangeset: changesets[0]?.id ?? loadedChangeset,
      changesetCount: changesets.length,
      authors: distinctAuthors(changesets.map((changeset) => changeset.owner)),
    },
    changesets,
  };
}
