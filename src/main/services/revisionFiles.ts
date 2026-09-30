import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dialog, shell } from 'electron';
import type { RevisionRef } from '@shared/domain/revision';
import type { CmClient } from '../cm/CmClient';
import { saveContent } from '../files/saveContent';

/** A revision of a file taken out of the repository: saved where the user picks, or opened in the OS's app for it. */
export interface RevisionFiles {
  /** Asks where to save it, then saves it there: the path saved, or null when the user cancelled. */
  saveAs(workspacePath: string, revision: RevisionRef, suggestedFileName: string): Promise<string | null>;
  open(workspacePath: string, revision: RevisionRef, fileName: string): Promise<void>;
}

export function revisionFiles(cm: CmClient): RevisionFiles {
  const download = (workspacePath: string, revision: RevisionRef, targetFile: string): Promise<void> =>
    saveContent(cm, workspacePath, { kind: 'revision', revision, fileName: targetFile }, targetFile);

  return {
    async saveAs(workspacePath, revision, suggestedFileName) {
      const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Save revision as', defaultPath: suggestedFileName });
      if (canceled || !filePath) return null;
      await download(workspacePath, revision, filePath);
      return filePath;
    },

    async open(workspacePath, revision, fileName) {
      // Keep the original name so the OS picks the right app; a folder of its own makes it unique, and never
      // overwrites a copy opened before that an app may still hold.
      const directory = await mkdtemp(join(tmpdir(), `uvcs-rev${revision.revisionId}-`));
      const targetFile = join(directory, fileName);
      await download(workspacePath, revision, targetFile);
      const error = await shell.openPath(targetFile);
      if (error) throw new Error(error);
    },
  };
}
