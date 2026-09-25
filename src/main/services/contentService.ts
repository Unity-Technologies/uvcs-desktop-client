import { readFile, writeFile } from 'node:fs/promises';
import type { ContentApi } from '@shared/api/content';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { EMPTY_CONTENT, toFileContent } from '../files/fileContent';
import { withTempPath } from '../files/tempFile';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createContentService({ cm }: ServiceContext): ContentApi {
  async function read(workspacePath: string, source: ContentSource): Promise<FileContent> {
    switch (source.kind) {
      case 'empty':
        return EMPTY_CONTENT;
      case 'workspaceFile': {
        const absolutePath = toAbsolutePath(workspacePath, source.path);
        return toFileContent(await readFile(absolutePath), absolutePath);
      }
      case 'workspaceBase':
        return downloadRevision(workspacePath, toAbsolutePath(workspacePath, source.path), source.path);
      case 'revision':
        return downloadRevision(workspacePath, `revid:${source.revisionId}`, source.fileName);
      case 'spec':
        return downloadRevision(workspacePath, source.spec, source.fileName ?? source.spec.split('#')[0]!);
    }
  }

  async function writeWorkspaceFile(workspacePath: string, path: string, text: string): Promise<void> {
    await writeFile(toAbsolutePath(workspacePath, path), text, 'utf8');
  }

  function downloadRevision(workspacePath: string, revisionSpec: string, fileName: string): Promise<FileContent> {
    return withTempPath(async (outputFile) => {
      await cm.query(['cat', revisionSpec, `--file=${outputFile}`], { cwd: workspacePath });
      return toFileContent(await readFile(outputFile), fileName);
    });
  }

  return { read, writeWorkspaceFile };
}
