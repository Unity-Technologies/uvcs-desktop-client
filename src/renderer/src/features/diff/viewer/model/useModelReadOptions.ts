import { useQuery } from '@tanstack/react-query';
import { useContext, useMemo } from 'react';
import type { ContentSource, ModelBytes } from '@shared/domain/content';
import { api } from '../../../../api/client';
import { queryKeys } from '../../../../api/queryKeys';
import { contentCaching } from '../useDiffContents';
import { DEFAULT_IMPORT_SETTINGS, readImportSettings, type ModelImportSettings } from './modelImportSettings';
import { SiblingFinderContext, sourcePathOf, type DiffSide } from './modelSiblings';
import type { ModelReadOptions } from './readModelFile';
import { useModelCompanions } from './useModelCompanions';

/**
 * What a version of a model is read with, once it is all read: the files it needs beside it (`useModelCompanions`)
 * and its import settings, from the `.meta` beside it (one read, cached as any content is). A model without a `.meta`
 * (outside a Unity project) or whose `.meta` can't be read has Unity's defaults. Null while any is being read.
 */
export function useModelReadOptions(
  workspacePath: string,
  side: DiffSide,
  source: ContentSource,
  model: ModelBytes | undefined,
  /** Settings already known (the `.meta` being diffed), which are not read again. */
  knownSettings?: ModelImportSettings,
): ModelReadOptions | null {
  const companions = useModelCompanions(workspacePath, side, source, model);
  const readSettings = useImportSettings(workspacePath, side, source, model !== undefined && knownSettings === undefined);
  const settings = knownSettings ?? readSettings;
  return useMemo(() => (companions && settings ? { companions, settings } : null), [companions, settings]);
}

function useImportSettings(workspacePath: string, side: DiffSide, source: ContentSource, wanted: boolean): ModelImportSettings | null {
  const findSibling = useContext(SiblingFinderContext);
  const path = sourcePathOf(source);
  const fileName = path?.split(/[\\/]/).pop();
  const meta = wanted && path !== null && fileName ? findSibling(side, source, path, `${fileName}.meta`) : null;
  const read = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'importSettings', meta),
    // A `.meta` that isn't there (outside a Unity project) is an answer, kept as any other: Unity's defaults.
    queryFn: async () => {
      const bytes = await api.content.readBytes(workspacePath, meta!);
      return bytes ? readImportSettings(new TextDecoder().decode(bytes)) : DEFAULT_IMPORT_SETTINGS;
    },
    enabled: meta !== null,
    ...(meta && contentCaching([meta])),
  });
  // A read that failed (the server) shows the defaults meanwhile, and is read again, never kept as the answer.
  if (meta === null || read.isError) return DEFAULT_IMPORT_SETTINGS;
  return read.data ?? null;
}
