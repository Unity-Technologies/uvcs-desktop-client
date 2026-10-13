import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ContentSource } from '@shared/domain/content';
import { api } from '../../../../../api/client';
import { queryKeys } from '../../../../../api/queryKeys';
import { contentCaching } from '../../useDiffContents';
import { DEFAULT_IMPORT_SETTINGS, readImportSettings, type ModelImportSettings } from '../modelImportSettings';
import type { MaterialVersion } from './materialVersion';

const SIDES = ['before', 'after'] as const;

/**
 * The import settings of the `.meta` the workspace has beside each version's model on disk, for a version none was
 * found for (`materialsInputOf`); null for the others, while reading, and where the workspace has none.
 */
export function useWorkspaceImportSettings(workspacePath: string, versions: Record<'before' | 'after', MaterialVersion | null>): Record<'before' | 'after', ModelImportSettings | null> {
  const metas = useMemo(
    () =>
      SIDES.map((side) => {
        const version = versions[side];
        return version?.path && version.options.settings === DEFAULT_IMPORT_SETTINGS ? `${version.path}.meta` : null;
      }),
    [versions],
  );
  // Both versions of a file at one path read its `.meta` once.
  const paths = useMemo(() => [...new Set(metas.flatMap((path) => (path ? [path] : [])))], [metas]);
  const reads = useQueries({
    queries: paths.map((path) => {
      const source: ContentSource = { kind: 'workspaceFile', path };
      return { queryKey: queryKeys.inWorkspace(workspacePath, 'contentBytes', source), queryFn: () => api.content.readBytes(workspacePath, source), ...contentCaching([source]) };
    }),
    combine: dataOf,
  });
  return useMemo(() => {
    const settingsOf = (path: string | null): ModelImportSettings | null => {
      const bytes = path === null ? null : reads[paths.indexOf(path)];
      return bytes ? readImportSettings(new TextDecoder().decode(bytes)) : null;
    };
    return { before: settingsOf(metas[0]!), after: settingsOf(metas[1]!) };
  }, [reads, paths, metas]);
}

/** The reads' bytes, one array while none changes: a function of its own, as TanStack runs a new one each render. */
function dataOf(results: { data?: Uint8Array | null }[]): (Uint8Array | null | undefined)[] {
  return results.map((result) => result.data);
}
