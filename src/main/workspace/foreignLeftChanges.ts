import type { Shelve } from '@shared/domain/shelve';
import type { LeftChanges } from '@shared/domain/switchWithChanges';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { AUTOMATIC_SHELVE_CONDITION, automaticShelveComment } from '../cm/automaticShelve';
import type { CmClient } from '../cm/CmClient';
import { findRecords, toShelve } from '../cm/findObjects';
import { selectorObjectRef } from './selectorObjectRef';
import { describeSelector } from './switchSelectors';
import { readShelveEntries } from './verifiedShelve';

/** The user's automatic shelves in the repository, whoever made them: this app, the official client or `cm switch`. */
export async function readAutomaticShelves(cm: CmClient, workspacePath: string): Promise<Shelve[]> {
  const xml = await cm.query(['find', 'shelve', `where owner = 'me' and ${AUTOMATIC_SHELVE_CONDITION}`, '--xml', '--nototal'], { cwd: workspacePath });
  return findRecords(xml, 'SHELVE').map(toShelve);
}

/**
 * The shelves among `unrecorded` (automatic shelves this app has no record of) left on `selector`, newest first: their
 * comment names its object id as the official client writes it.
 */
export async function shelvesLeftOn(cm: CmClient, workspacePath: string, selector: WorkspaceSelector, unrecorded: Shelve[]): Promise<Shelve[]> {
  // Without such shelves there is nothing to match: the selector's object id would cost a server lookup for nothing.
  if (unrecorded.length === 0) return [];
  const objectRef = await selectorObjectRef(cm, workspacePath, selector);
  if (!objectRef) return [];
  const comment = automaticShelveComment(objectRef);
  return unrecorded.filter((shelve) => shelve.comment === comment).sort((a, b) => b.id - a.id);
}

/** How "Welcome back" offers a shelve another app left on `selector`, counting its changes (one `cm diff` each). */
export async function toForeignLeftChanges(cm: CmClient, workspacePath: string, selector: WorkspaceSelector, shelve: Shelve): Promise<LeftChanges> {
  return {
    shelveId: shelve.id,
    sourceName: describeSelector(selector),
    mode: 'leave',
    reason: 'switch',
    count: (await readShelveEntries(cm, workspacePath, shelve.id)).length,
    createdAt: shelve.date,
    foreign: true,
  };
}
