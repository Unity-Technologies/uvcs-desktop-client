import { readFile, writeFile } from 'node:fs/promises';
import type { ContentApi } from '@shared/api/content';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { EMPTY_CONTENT, toFileContent } from '../files/fileContent';
import { saveContent } from '../files/saveContent';
import { withTempPath } from '../files/tempFile';
import { retryWhileBusy } from '../files/whileBusy';
import { toAbsolutePath } from '../files/workspacePaths';
import type { ServiceContext } from './ServiceContext';

export function createContentService({ cm, reviews }: ServiceContext): ContentApi {
  async function read(workspacePath: string, source: ContentSource): Promise<FileContent> {
    switch (source.kind) {
      case 'empty':
        return EMPTY_CONTENT;
      case 'workspaceFile': {
        const absolutePath = toAbsolutePath(workspacePath, source.path);
        return toFileContent(await readFile(absolutePath), absolutePath);
      }
      case 'reviewSnapshot':
        return reviews.readSnapshot(workspacePath, source.path);
      case 'workspaceBase':
      case 'revision':
      case 'spec':
        return withTempPath(async (outputFile) => {
          await saveContent(cm, workspacePath, source, outputFile);
          return toFileContent(await readFile(outputFile), fileNameOf(source));
        });
    }
  }

  /** The text as the editor has it, line breaks included (the file's own). Written in place, keeping the file's identity. */
  async function writeWorkspaceFile(workspacePath: string, path: string, text: string): Promise<void> {
    await retryWhileBusy(() => writeFile(toAbsolutePath(workspacePath, path), text, 'utf8'));
  }

  return { read, writeWorkspaceFile };
}

/** The name that tells images and syntax apart: the spec's path when the source names no file. */
function fileNameOf(source: Extract<ContentSource, { kind: 'workspaceBase' | 'revision' | 'spec' }>): string {
  if (source.kind === 'workspaceBase') return source.path;
  if (source.kind === 'revision') return source.fileName;
  return source.fileName ?? source.spec.split('#')[0]!;
}
