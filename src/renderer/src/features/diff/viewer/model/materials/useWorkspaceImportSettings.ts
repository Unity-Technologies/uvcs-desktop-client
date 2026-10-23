import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { workspacePlace } from '@shared/domain/place';
import { contentBytesQuery } from '../../contentQueries';
import { readImportSettings, type ModelImportSettings } from '../modelImportSettings';
import { takesWorkspaceSettings, type MaterialVersion } from './materialVersion';

const SIDES = ['before', 'after'] as const;

/**
 * The import settings of the `.meta` the workspace has beside each version's model on disk, for a version none was
 * found for (`takesWorkspaceSettings`); undefined while it is read; null for the others, where the workspace has none
 * (or it can't be read), and without a workspace (null), whose disk there isn't.
 */
export function useWorkspaceImportSettings(
  workspacePath: string | null,
  versions: Record<'before' | 'after', MaterialVersion | null>,
): Record<'before' | 'after', ModelImportSettings | null | undefined> {
  const metas = useMemo(
    () =>
      SIDES.map((side) => {
        const version = versions[side];
        return workspacePath !== null && version?.path && takesWorkspaceSettings(version.options) ? `${version.path}.meta` : null;
      }),
    [workspacePath, versions],
  );
  // Both versions of a file at one path read its `.meta` once.
  const paths = useMemo(() => [...new Set(metas.flatMap((path) => (path ? [path] : [])))], [metas]);
  const reads = useQueries({
    queries: workspacePath === null ? [] : paths.map((path) => contentBytesQuery(workspacePlace(workspacePath), { kind: 'workspaceFile', path })),
    combine: dataOf,
  });
  return useMemo(() => {
    const settingsOf = (path: string | null): ModelImportSettings | null | undefined => {
      if (path === null) return null;
      const bytes = reads[paths.indexOf(path)];
      return bytes ? readImportSettings(new TextDecoder().decode(bytes)) : bytes;
    };
    return { before: settingsOf(metas[0]!), after: settingsOf(metas[1]!) };
  }, [reads, paths, metas]);
}

/**
 * The reads' bytes (null where there is no `.meta` or it can't be read, undefined while it is read), one array while
 * none changes: a function of its own, as TanStack runs a new one each render.
 */
function dataOf(results: { data?: Uint8Array | null; isError: boolean }[]): (Uint8Array | null | undefined)[] {
  return results.map((result) => (result.isError ? null : result.data));
}
