import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dialog, shell } from 'electron';
import type { HistoryApi } from '@shared/api/history';
import {
  itemHistoryArgs,
  itemHistoryTarget,
  itemRevisionsArgs,
  parseHistoryRecords,
  parseItemHistory,
  parseWorkspaceRevision,
  workspaceRevisionArgs,
} from '../cm/itemHistory';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createHistoryService({ cm }: ServiceContext): HistoryApi {
  const downloadRevision = async (workspacePath: string, revisionId: number, targetFile: string): Promise<void> => {
    await cm.query(['cat', `revid:${revisionId}`, `--file=${targetFile}`], { cwd: workspacePath });
  };

  return {
    async forItem(workspacePath, path, changesetId) {
      // Read alongside the history: which of its revisions the workspace has, from the workspace itself.
      const workspaceRevision =
        changesetId === undefined
          ? cm.query(workspaceRevisionArgs(toAbsolutePath(workspacePath, path)), { cwd: workspacePath }).then(parseWorkspaceRevision, () => undefined)
          : Promise.resolve(undefined);
      const records = parseHistoryRecords(await cm.query(itemHistoryArgs(itemHistoryTarget(workspacePath, path, changesetId)), { cwd: workspacePath }));
      const revisionsArgs = itemRevisionsArgs(records);
      return parseItemHistory(records, revisionsArgs ? await cm.query(revisionsArgs, { cwd: workspacePath }) : '', await workspaceRevision);
    },

    async revertTo(workspacePath, path, changesetId) {
      await cm.query(['revert', `${toAbsolutePath(workspacePath, path)}#cs:${changesetId}`], { cwd: workspacePath });
    },

    async saveRevisionAs(workspacePath, revisionId, suggestedFileName) {
      const result = await dialog.showSaveDialog({ title: 'Save revision as', defaultPath: suggestedFileName });
      if (result.canceled || !result.filePath) return null;
      await downloadRevision(workspacePath, revisionId, result.filePath);
      return result.filePath;
    },

    async openRevision(workspacePath, revisionId, fileName) {
      // Keep the original name so the OS picks the right app; the temp folder makes it unique.
      const directory = await mkdtemp(join(tmpdir(), `uvcs-rev${revisionId}-`));
      const targetFile = join(directory, fileName);
      await downloadRevision(workspacePath, revisionId, targetFile);
      const error = await shell.openPath(targetFile);
      if (error) throw new Error(error);
    },
  };
}
