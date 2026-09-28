import type { ChangesetsApi } from '@shared/api/changesets';
import { escapeQueryValue, findArgs } from '../cm/findQuery';
import { findRecords, toChangeset } from '../cm/findObjects';
import type { ServiceContext } from './ServiceContext';

export function createChangesetsService({ cm }: ServiceContext): ChangesetsApi {
  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('changeset', filter, 'changesetid desc'), { cwd: workspacePath });
      return findRecords(xml, 'CHANGESET').map(toChangeset);
    },

    async get(workspacePath, changesetId, repository) {
      const where = `where changesetid = ${changesetId}${repository ? ` on repository '${escapeQueryValue(repository)}'` : ''}`;
      const xml = await cm.query(['find', 'changeset', where, '--xml', '--nototal'], { cwd: workspacePath });
      const [changeset] = findRecords(xml, 'CHANGESET').map(toChangeset);
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
