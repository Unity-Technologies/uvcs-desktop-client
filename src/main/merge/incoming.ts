import type { Changeset } from '@shared/domain/changeset';
import {
  INCOMING_CHANGESETS_PAGE,
  type BranchIncoming,
  type IncomingChangesetPage,
  type IncomingChangesetsRequest,
  type IncomingChanges,
  type IncomingSummary,
  type LoadedBranch,
  type NothingIncoming,
} from '@shared/domain/incoming';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { queryDiffEntries } from '../cm/diffEntries';
import { FOUND_CHANGESETS } from '../cm/foundObjects';
import { equalsCondition, findArgs } from '../cm/findQuery';
import { layoutReader, recordFormat } from '../cm/formatRecords';
import { readWorkspaceLoad } from '../cm/workspaceStatus';
import { readPendingChanges } from '../workspace/readPendingChanges';
import { findUpdateBlockers, findUpdateConflicts } from './updateCollisions';

const NOTHING_INCOMING: NothingIncoming = { branch: null, changesetCount: 0, countCapped: false, authors: [] };

/**
 * How many changesets the check counts at most. Beyond it, the chip says "100+": the server sends as much for a
 * workspace 100,000 changesets behind as for one 100 behind.
 */
export const INCOMING_CHECK_LIMIT = 100;

/**
 * How many changesets the branch has after the loaded one (up to `INCOMING_CHECK_LIMIT`), and by whom. Polled, so it is
 * a single `cm find` returning only the newest changeset numbers and owners; the renderer tells where the workspace
 * stands (its workspace info follows `.plastic`).
 */
export async function readIncomingSummary(cm: CmClient, workspacePath: string, loaded: LoadedBranch): Promise<IncomingSummary> {
  if (!loaded) return NOTHING_INCOMING;
  const { branch, loadedChangeset } = loaded;
  const newest = await cm.queryRecords(incomingChangesetsArgs(branch, loadedChangeset), ([id, owner = '']) => ({ id: Number(id), owner }), { cwd: workspacePath });
  return summarizeIncoming(branch, loadedChangeset, newest, INCOMING_CHECK_LIMIT);
}

/** The check's `cm find`: one more changeset than it counts, so that one tells there are more. */
export function incomingChangesetsArgs(branch: string, loadedChangeset: number): string[] {
  return [
    'find',
    'changeset',
    `${incomingCondition(branch, loadedChangeset)} order by changesetid desc limit ${INCOMING_CHECK_LIMIT + 1}`,
    `--format=${recordFormat(['changesetid', 'owner'])}`,
    '--nototal',
  ];
}

function incomingCondition(branch: string, loadedChangeset: number): string {
  return `where changesetid > ${loadedChangeset} and ${equalsCondition('branch', branch)}`;
}

/**
 * Where the workspace stands from the newest incoming changesets read, at most `limit` of them counted: one more than
 * that means there are more (`countCapped`).
 */
export function summarizeIncoming(branch: string, loadedChangeset: number, newest: { id: number; owner: string }[], limit: number): BranchIncoming {
  const counted = [...newest].sort((a, b) => b.id - a.id).slice(0, limit);
  return {
    branch,
    loadedChangeset,
    headChangeset: counted[0]?.id ?? loadedChangeset,
    changesetCount: counted.length,
    countCapped: newest.length > limit,
    authors: distinctAuthors(counted.map((changeset) => changeset.owner)),
  };
}

function distinctAuthors(owners: string[]): string[] {
  return [...new Set(owners.filter(Boolean))];
}

/**
 * What updating brings: the newest page of incoming changesets (`readIncomingChangesetPage` reads the older ones), the
 * one diff from the loaded changeset to the head, and which local changes it collides with.
 */
export async function readIncomingChanges(cm: CmClient, workspacePath: string): Promise<IncomingChanges> {
  const { summary, changesets, moreChangesets } = await readNewestIncomingChangesets(cm, workspacePath);
  if (!summary.branch || changesets.length === 0) return { ...summary, changesets, moreChangesets, files: [], conflicts: [], blockedPaths: [] };

  const [files, { changes: local }] = await Promise.all([
    queryDiffEntries(cm, [spec.changeset(summary.loadedChangeset), spec.changeset(summary.headChangeset)], { cwd: workspacePath }),
    readPendingChanges(cm, workspacePath, ['--controlledchanged', '--changed']),
  ]);

  return { ...summary, changesets, moreChangesets, files, conflicts: findUpdateConflicts(files, local), blockedPaths: findUpdateBlockers(files, local) };
}

interface NewestIncoming {
  summary: IncomingSummary;
  changesets: Changeset[];
  moreChangesets: boolean;
}

async function readNewestIncomingChangesets(cm: CmClient, workspacePath: string): Promise<NewestIncoming> {
  const { selector, loadedChangeset } = await readWorkspaceLoad(cm, workspacePath);
  // Only a shelve has no loaded changeset, and a shelve is no branch.
  if (selector.kind !== 'branch' || loadedChangeset === null) return { summary: NOTHING_INCOMING, changesets: [], moreChangesets: false };

  const branch = selector.name;
  const { changesets, more } = await readIncomingChangesetPage(cm, workspacePath, { branch, loadedChangeset, limit: INCOMING_CHANGESETS_PAGE });
  const summary = summarizeIncoming(branch, loadedChangeset, changesets, INCOMING_CHANGESETS_PAGE);
  return { summary: { ...summary, countCapped: more }, changesets, moreChangesets: more };
}

/**
 * One page of the incoming changesets, newest first: the newest `limit` after the loaded one, or those older than
 * `olderThan`. One bounded `cm find`, asking for one more than `limit` to tell whether older ones remain.
 */
export async function readIncomingChangesetPage(cm: CmClient, workspacePath: string, request: IncomingChangesetsRequest): Promise<IncomingChangesetPage> {
  const { branch, loadedChangeset, olderThan, limit } = request;
  const conditions = [`changesetid > ${loadedChangeset}`, ...(olderThan === undefined ? [] : [`changesetid < ${olderThan}`])];
  const args = findArgs(FOUND_CHANGESETS, { branch, limit: limit + 1 }, 'changesetid desc', conditions);
  const found = await cm.queryRecords(args, layoutReader(FOUND_CHANGESETS), { cwd: workspacePath });
  return { changesets: found.slice(0, limit), more: found.length > limit };
}
