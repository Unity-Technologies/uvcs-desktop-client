// The queries of a version's content and of a file's bytes beside a model (a `.meta`, a `.mtl`, a `.bin`), cached as
// any content is (`contentCaching`). Built here, never inline in a hook or component: TanStack keeps a query's
// options, its query function with them, for as long as the query is cached (an hour for a revision), and a function
// made inside a hook keeps that hook's whole scope alive. The model diff's hooks hold both versions' bytes and parsed
// models: a heap snapshot found 107 MB kept that way after the viewer was gone.

import type { ContentSource, FileContent } from '@shared/domain/content';
import { api } from '../../../api/client';
import { queryKeys } from '../../../api/queryKeys';
import { contentCaching } from './useDiffContents';

export function contentQuery(workspacePath: string, source: ContentSource) {
  return {
    queryKey: queryKeys.inWorkspace(workspacePath, 'content', source),
    queryFn: (): Promise<FileContent> => api.content.read(workspacePath, source),
    ...contentCaching([source]),
  };
}

/** A file's bytes; null where it isn't there, an answer kept as any other (a failure is read again). */
export function contentBytesQuery(workspacePath: string, source: ContentSource) {
  return {
    queryKey: queryKeys.inWorkspace(workspacePath, 'contentBytes', source),
    queryFn: (): Promise<Uint8Array | null> => api.content.readBytes(workspacePath, source),
    ...contentCaching([source]),
  };
}
