import type { ChangesetsApi } from '@shared/api/changesets';
import { findArgs } from '../cm/findQuery';
import { findRecords, toChangeset } from '../cm/findObjects';
import { child, integer, parseXml } from '../cm/parseXml';
import { withTempFile } from '../files/tempFile';
import type { ServiceContext } from './ServiceContext';

export function createChangesetsService({ cm, operations }: ServiceContext): ChangesetsApi {
  const loadedChangeset = async (workspacePath: string): Promise<number> => {
    const xml = await cm.query(['status', '--header', '--xml'], { cwd: workspacePath });
    const status = child(child(child(parseXml(xml, []), 'StatusOutput'), 'WorkspaceStatus'), 'Status');
    return integer(status?.Changeset);
  };

  return {
    async list(workspacePath, filter) {
      const xml = await cm.query(findArgs('changeset', filter, 'changesetid desc'), { cwd: workspacePath });
      return findRecords(xml, 'CHANGESET').map(toChangeset);
    },

    async get(workspacePath, changesetId) {
      const xml = await cm.query(['find', 'changeset', `where changesetid = ${changesetId}`, '--xml', '--nototal'], { cwd: workspacePath });
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

    async applyLabel(workspacePath, changesetId, labelName, comment) {
      await withTempFile(comment, (commentsFile) =>
        cm.query(['label', 'create', `lb:${labelName}`, `cs:${changesetId}`, `-commentsfile=${commentsFile}`], { cwd: workspacePath }),
      );
    },

    revertWorkspaceTo(workspacePath, changesetId, operationId) {
      return operations.run(operationId, async ({ signal, reportProgress }) => {
        const loaded = await loadedChangeset(workspacePath);
        if (changesetId >= loaded) throw new Error(`Changeset ${changesetId} is not older than the loaded changeset ${loaded}.`);

        await cm.execute(
          ['merge', `cs:${loaded}`, '--subtractive', `--interval-origin=cs:${changesetId}`, '--merge', '--machinereadable'],
          { cwd: workspacePath, signal, onOutputLine: reportProgress },
        );
      });
    },
  };
}
