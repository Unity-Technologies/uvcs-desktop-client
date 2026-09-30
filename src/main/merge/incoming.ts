import type { Changeset } from '@shared/domain/changeset';
import type { BranchIncoming, IncomingChanges, IncomingSummary, LoadedBranch, NothingIncoming } from '@shared/domain/incoming';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { DIFF_FORMAT, parseDiffEntries } from '../cm/diffEntries';
import { findRecords, toChangeset } from '../cm/findObjects';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readWorkspaceStatus } from '../cm/workspaceStatus';
import { findUpdateBlockers, findUpdateConflicts } from './updateCollisions';

const NOTHING_INCOMING: NothingIncoming = { branch: null, changesetCount: 0, authors: [] };

/**
 * How many changesets the branch has after the loaded one, and by whom. Polled, so it is a single `cm find` returning
 * only changeset numbers and owners; the renderer tells where the workspace stands (its workspace info follows `.plastic`).
 */
export async function readIncomingSummary(cm: CmClient, workspacePath: string, loaded: LoadedBranch): Promise<IncomingSummary> {
  if (!loaded) return NOTHING_INCOMING;
  const { branch, loadedChangeset } = loaded;
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

export function summarizeIncoming(branch: string, loadedChangeset: number, incoming: { id: number; owner: string }[]): BranchIncoming {
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
  if (!summary.branch || changesets.length === 0) return { ...summary, changesets, files: [], conflicts: [], blockedPaths: [] };

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

async function readIncomingChangesets(cm: CmClient, workspacePath: string): Promise<{ summary: IncomingSummary; changesets: Changeset[] }> {
  const { selector, loadedChangeset } = await readWorkspaceStatus(cm, workspacePath);
  // Only a shelve has no loaded changeset, and a shelve is no branch.
  if (selector.kind !== 'branch' || loadedChangeset === null) return { summary: NOTHING_INCOMING, changesets: [] };

  const branch = selector.name;
  const xml = await cm.query(findArgs('changeset', { branch }, 'changesetid desc', [`changesetid > ${loadedChangeset}`]), { cwd: workspacePath });
  const changesets = findRecords(xml, 'CHANGESET').map(toChangeset);
  return { summary: summarizeIncoming(branch, loadedChangeset, changesets), changesets };
}
