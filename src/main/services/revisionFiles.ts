import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dialog, shell } from 'electron';
import type { RevisionRef } from '@shared/domain/revision';
import type { CmClient } from '../cm/CmClient';
import { saveContent } from '../files/saveContent';

/** A revision of a file taken out of the repository: saved where the user picks, or opened in an app. */
export interface RevisionFiles {
  /** Asks where to save it, then saves it there: the path saved, or null when the user cancelled. */
  saveAs(workspacePath: string, revision: RevisionRef, suggestedFileName: string): Promise<string | null>;
  /** Opens it in the editor `editorId`, or in the OS's app for its type when it's omitted. */
  open(workspacePath: string, revision: RevisionRef, fileName: string, editorId?: string): Promise<void>;
}

/** `openInEditor` opens a saved file in one of the user's editors (`ExternalAppsCatalog`). */
export function revisionFiles(cm: CmClient, openInEditor: (path: string, editorId: string) => Promise<void>): RevisionFiles {
  const download = (workspacePath: string, revision: RevisionRef, targetFile: string): Promise<void> =>
    saveContent(cm, workspacePath, { kind: 'revision', revision, fileName: targetFile }, targetFile);

  return {
    async saveAs(workspacePath, revision, suggestedFileName) {
      const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Save revision as', defaultPath: suggestedFileName });
      if (canceled || !filePath) return null;
      await download(workspacePath, revision, filePath);
      return filePath;
    },

    async open(workspacePath, revision, fileName, editorId) {
      // Keep the original name so the OS picks the right app; a folder of its own makes it unique, and never
      // overwrites a copy opened before that an app may still hold.
      const directory = await mkdtemp(join(tmpdir(), `uvcs-rev${revision.revisionId}-`));
      const targetFile = join(directory, fileName);
      await download(workspacePath, revision, targetFile);
      if (editorId) return openInEditor(targetFile, editorId);
      const error = await shell.openPath(targetFile);
      if (error) throw new Error(error);
    },
  };
}
