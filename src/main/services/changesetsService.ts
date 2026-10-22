import type { ChangesetsApi } from '@shared/api/changesets';
import { findArgs, findQueryArgs } from '../cm/findQuery';
import { FOUND_CHANGESETS } from '../cm/foundObjects';
import { layoutReader, readRecords } from '../cm/formatRecords';
import type { ServiceContext } from './ServiceContext';

/**
 * `cm find changeset` leaves out the changesets of hidden branches unless asked for: a branch named in the filter
 * shows its changesets whether it is hidden or not, while the list of every branch keeps hidden ones out.
 */
const IGNORE_HIDDEN = "ignorehidden = 'true'";

export function createChangesetsService({ cm }: ServiceContext): ChangesetsApi {
  return {
    // Read as they arrive: every changeset of a large repository (280,000) is tens of MB.
    list(workspacePath, filter) {
      const args = findArgs(FOUND_CHANGESETS, filter, 'changesetid desc', filter.branch ? [IGNORE_HIDDEN] : []);
      return cm.queryRecords(args, layoutReader(FOUND_CHANGESETS), { cwd: workspacePath });
    },

    async get(workspacePath, changesetId, repository) {
      const where = `where changesetid = ${changesetId}${repository ? ` on repository '${repository}'` : ''}`;
      const output = await cm.query(findQueryArgs(FOUND_CHANGESETS, where), { cwd: workspacePath });
      const [changeset] = readRecords(FOUND_CHANGESETS, output);
      if (!changeset) throw new Error(`Changeset ${changesetId} was not found.`);
      return changeset;
    },

    async editComment(workspacePath, changesetId, comment) {
      await cm.query(['changeset', 'editcomment', `cs:${changesetId}`, comment], { cwd: workspacePath });
    },

    async moveToBranch(workspacePath, changesetId, branch) {
      await cm.query(['changeset', 'move', `cs:${changesetId}`, `br:${branch}`], { cwd: workspacePath });
    },

    async remove(workspacePath, changesetId) {
      await cm.query(['changeset', 'delete', `cs:${changesetId}`], { cwd: workspacePath });
    },
  };
}
