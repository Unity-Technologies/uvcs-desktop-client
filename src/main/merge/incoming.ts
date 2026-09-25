import type { Changeset } from '@shared/domain/changeset';
import type { DiffEntry } from '@shared/domain/diff';
import type { IncomingChanges, IncomingSummary, UpdateConflict } from '@shared/domain/incoming';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { DIFF_ENTRY_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { findRecords, toChangeset } from '../cm/findObjects';
import { findArgs } from '../cm/findQuery';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readWorkspaceStatus } from '../cm/workspaceStatus';

const LOCAL_CONTENT_CHANGES = new Set(['changed', 'checkedOut', 'replaced']);

export async function readIncomingSummary(cm: CmClient, workspacePath: string): Promise<IncomingSummary> {
  const { summary } = await readIncomingChangesets(cm, workspacePath);
  return summary;
}

export async function readIncomingChanges(cm: CmClient, workspacePath: string): Promise<IncomingChanges> {
  const { summary, changesets } = await readIncomingChangesets(cm, workspacePath);
  if (changesets.length === 0) return { ...summary, changesets, files: [], conflicts: [], blockedPaths: [] };

  const [diffOutput, statusXml] = await Promise.all([
    cm.query(['diff', spec.changeset(summary.loadedChangeset), spec.changeset(summary.headChangeset), `--format=${DIFF_ENTRY_FORMAT}`], {
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
    }));
}

async function readIncomingChangesets(cm: CmClient, workspacePath: string): Promise<{ summary: IncomingSummary; changesets: Changeset[] }> {
  const status = await readWorkspaceStatus(cm, workspacePath);
  const loadedChangeset = status.loadedChangeset;
  if (status.selector.kind !== 'branch') {
    return { summary: { branch: null, loadedChangeset, headChangeset: loadedChangeset, changesetCount: 0 }, changesets: [] };
  }

  const branch = status.selector.name;
  const xml = await cm.query(findArgs('changeset', { branch }, 'changesetid desc', [`changesetid > ${loadedChangeset}`]), { cwd: workspacePath });
  const changesets = findRecords(xml, 'CHANGESET').map(toChangeset);

  return {
    summary: { branch, loadedChangeset, headChangeset: changesets[0]?.id ?? loadedChangeset, changesetCount: changesets.length },
    changesets,
  };
}
