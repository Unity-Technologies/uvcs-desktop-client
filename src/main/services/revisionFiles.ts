import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { dialog, shell } from 'electron';
import type { RepositoryVersion } from '@shared/domain/content';
import type { Place } from '@shared/domain/place';
import type { CmClient } from '../cm/CmClient';
import { saveVersion } from '../files/saveContent';
import type { WorkspaceCopies } from '../files/WorkspaceCopies';

/**
 * A version of a file taken out of the repository (a revision, or a path or item at a changeset: a merge's sides):
 * saved where the user picks, or opened in an app.
 */
export interface RevisionFiles {
  /** Asks where to save it, then saves it there: the path saved, or null when the user cancelled. */
  saveAs(place: Place, version: RepositoryVersion, suggestedFileName: string): Promise<string | null>;
  /** Opens it in the editor `editorId`, or in the OS's app for its type when it's omitted. */
  open(place: Place, version: RepositoryVersion, fileName: string, editorId?: string): Promise<void>;
}

/**
 * `openInEditor` opens a saved file in one of the user's editors (`ExternalAppsCatalog`). A revision a workspace holds
 * unchanged is copied from its disk (`copies`), never downloaded.
 */
export function revisionFiles(cm: CmClient, copies: Pick<WorkspaceCopies, 'read'>, openInEditor: (path: string, editorId: string) => Promise<void>): RevisionFiles {
  const download = (place: Place, version: RepositoryVersion, targetFile: string): Promise<void> => saveVersion(cm, copies, place, version, targetFile);

  return {
    async saveAs(place, version, suggestedFileName) {
      const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Save revision as', defaultPath: suggestedFileName });
      if (canceled || !filePath) return null;
      await download(place, version, filePath);
      return filePath;
    },

    async open(place, version, fileName, editorId) {
      const targetFile = await saveRevisionToTemp(cm, copies, place, version, fileName);
      if (editorId) return openInEditor(targetFile, editorId);
      const error = await shell.openPath(targetFile);
      if (error) throw new Error(error);
    },
  };
}

/**
 * Saves a version to a temp file named `fileName`, for an app or a tool to open: the path saved. It keeps the original
 * name so the OS picks the right app; a folder of its own makes it unique, and never overwrites a copy opened before
 * that an app may still hold. Only the name's last part counts: the renderer sends it, and `../` would leave the folder.
 */
export async function saveRevisionToTemp(cm: CmClient, copies: Pick<WorkspaceCopies, 'read'>, place: Place, version: RepositoryVersion, fileName: string): Promise<string> {
  const targetFile = join(await mkdtemp(join(tmpdir(), 'uvcs-rev-')), basename(fileName));
  await saveVersion(cm, copies, place, version, targetFile);
  return targetFile;
}
