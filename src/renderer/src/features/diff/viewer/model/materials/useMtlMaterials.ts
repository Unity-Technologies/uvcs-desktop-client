import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ContentSource } from '@shared/domain/content';
import { contentBytesQuery } from '../../contentQueries';
import type { FileMaterial } from '../parsedModel';
import { uniqueFiles } from './assetAnswers';
import type { MaterialVersion } from './materialVersion';
import { objMaterialLibraries, readMtlMaterials } from './mtlMaterials';


const SIDES = ['before', 'after'] as const;

/**
 * An OBJ's `.mtl` materials, read beside it as the version of it that goes with each version of the model (its
 * `SiblingFinder`: the disk's for a workspace file, the diff's revision for a committed one); null for another format.
 */
export function useMtlMaterials(workspacePath: string, versions: Record<'before' | 'after', MaterialVersion | null>): Record<'before' | 'after', FileMaterial[] | null> {
  const files = useMemo(() => SIDES.map((side) => mtlFiles(versions[side])), [versions]);
  const reads = useQueries({
    queries: uniqueFiles(files.flat(), sourceKey).map((source) => contentBytesQuery(workspacePath, source)),
    combine: dataOf,
  });
  return useMemo(() => {
    const byKey = new Map(uniqueFiles(files.flat(), sourceKey).map((source, i) => [sourceKey(source), reads[i]]));
    const [before, after] = files.map((sideFiles) => {
      if (sideFiles.length === 0) return null;
      return sideFiles.flatMap((source) => {
        const bytes = byKey.get(sourceKey(source));
        return bytes ? readMtlMaterials(new TextDecoder().decode(bytes)) : [];
      });
    });
    return { before: before!, after: after! };
  }, [files, reads]);
}

/** The `.mtl` files an OBJ names, beside it; none for another format, or where none goes with the version. */
function mtlFiles(version: MaterialVersion | null): ContentSource[] {
  if (!version || version.model.format !== 'obj') return [];
  return objMaterialLibraries(new TextDecoder().decode(version.bytes.bytes)).flatMap((name) => version.sibling(name) ?? []);
}

function sourceKey(source: ContentSource): string {
  return JSON.stringify(source);
}

/** The reads' bytes, one array while none changes: a function of its own, as TanStack runs a new one each render. */
function dataOf(results: { data?: Uint8Array | null }[]): (Uint8Array | null | undefined)[] {
  return results.map((result) => result.data);
}
