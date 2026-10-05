import { useQuery } from '@tanstack/react-query';
import { useContext, useMemo } from 'react';
import type { ContentSource, ModelBytes } from '@shared/domain/content';
import { api } from '../../../../api/client';
import { queryKeys } from '../../../../api/queryKeys';
import { contentCaching } from '../useDiffContents';
import { DEFAULT_IMPORT_SETTINGS, readImportSettings, type ModelImportSettings } from './modelImportSettings';
import { SiblingFinderContext, type DiffSide } from './modelSiblings';
import type { ModelReadOptions } from './readModelFile';
import { useModelCompanions } from './useModelCompanions';

/**
 * What a version of a model is read with, once it is all read: the files it needs beside it (`useModelCompanions`)
 * and its import settings, from the `.meta` beside it (one read, cached as any content is). A model without a `.meta`
 * (outside a Unity project) or whose `.meta` can't be read has Unity's defaults. Null while any is being read.
 */
export function useModelReadOptions(workspacePath: string, side: DiffSide, source: ContentSource, path: string, model: ModelBytes | undefined): ModelReadOptions | null {
  const companions = useModelCompanions(workspacePath, side, source, path, model);
  const settings = useImportSettings(workspacePath, side, source, path, model !== undefined);
  return useMemo(() => (companions && settings ? { companions, settings } : null), [companions, settings]);
}

function useImportSettings(workspacePath: string, side: DiffSide, source: ContentSource, path: string, wanted: boolean): ModelImportSettings | null {
  const findSibling = useContext(SiblingFinderContext);
  const fileName = path.split(/[\\/]/).pop() ?? path;
  const meta = wanted ? findSibling(side, source, path, `${fileName}.meta`) : null;
  const read = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'content', meta),
    queryFn: () => api.content.read(workspacePath, meta!),
    enabled: meta !== null,
    retry: false,
    ...(meta && contentCaching([meta])),
  });
  return useMemo(() => {
    if (meta === null || read.isError) return DEFAULT_IMPORT_SETTINGS;
    return read.data ? readImportSettings(read.data.text ?? '') : null;
  }, [meta, read.isError, read.data]);
}
