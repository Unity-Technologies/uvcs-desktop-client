import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ContentSource } from '@shared/domain/content';
import { api } from '../../../../../api/client';
import { queryKeys } from '../../../../../api/queryKeys';
import { contentCaching } from '../../useDiffContents';
import { siblingPath } from '../modelSiblings';
import type { FileMaterial } from '../parsedModel';
import { uniqueFiles } from './assetAnswers';
import type { MaterialVersion } from './materialVersion';
import { objMaterialLibraries, readMtlMaterials } from './mtlMaterials';

type WorkspaceFileSource = Extract<ContentSource, { kind: 'workspaceFile' }>;

const SIDES = ['before', 'after'] as const;

/** An OBJ's `.mtl` materials, read beside it in the workspace on disk; null for another format or while reading. */
export function useMtlMaterials(workspacePath: string, versions: Record<'before' | 'after', MaterialVersion | null>): Record<'before' | 'after', FileMaterial[] | null> {
  const files = useMemo(() => SIDES.map((side) => mtlFiles(versions[side])), [versions]);
  const reads = useQueries({
    queries: uniqueFiles(files.flat()).map((source) => ({
      queryKey: queryKeys.inWorkspace(workspacePath, 'contentBytes', source),
      queryFn: () => api.content.readBytes(workspacePath, source),
      ...contentCaching([source]),
    })),
    combine: dataOf,
  });
  return useMemo(() => {
    const byPath = new Map(uniqueFiles(files.flat()).map((source, i) => [source.path, reads[i]]));
    const [before, after] = files.map((sideFiles) => {
      if (sideFiles.length === 0) return null;
      return sideFiles.flatMap((source) => {
        const bytes = byPath.get(source.path);
        return bytes ? readMtlMaterials(new TextDecoder().decode(bytes)) : [];
      });
    });
    return { before: before!, after: after! };
  }, [files, reads]);
}

/** The `.mtl` files an OBJ names, beside it in the workspace on disk; none for another format. */
function mtlFiles(version: MaterialVersion | null): WorkspaceFileSource[] {
  if (!version || version.model.format !== 'obj' || !version.path) return [];
  return objMaterialLibraries(new TextDecoder().decode(version.bytes.bytes)).flatMap((name) => {
    const path = siblingPath(version.path!, name);
    return path === null ? [] : [{ kind: 'workspaceFile', path } satisfies WorkspaceFileSource];
  });
}

/** The reads' bytes, one array while none changes: a function of its own, as TanStack runs a new one each render. */
function dataOf(results: { data?: Uint8Array | null }[]): (Uint8Array | null | undefined)[] {
  return results.map((result) => result.data);
}
