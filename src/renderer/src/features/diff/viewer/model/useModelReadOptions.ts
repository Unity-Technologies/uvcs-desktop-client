import { useQuery } from '@tanstack/react-query';
import { useContext, useMemo } from 'react';
import type { Place } from '@shared/domain/place';
import type { ContentSource, ModelBytes } from '@shared/domain/content';
import { api } from '../../../../api/client';
import { queryKeys } from '../../../../api/queryKeys';
import { contentCaching } from '../contentQueries';
import { DEFAULT_IMPORT_SETTINGS, readImportSettings, type ImportSettingsSource, type ModelImportSettings } from './modelImportSettings';
import { SiblingFinderContext, sourcePathOf, type DiffSide } from './modelSiblings';
import type { ModelReadOptions } from './readModelFile';
import { useModelCompanions } from './useModelCompanions';

/**
 * What a version of a model is read with, once it is all read: the files it needs beside it (`useModelCompanions`)
 * and its import settings, from the `.meta` beside it (one read, cached as any content is). A model without a `.meta`
 * (outside a Unity project) or whose `.meta` can't be read has Unity's defaults. Null while any is being read.
 */
export function useModelReadOptions(
  place: Place,
  side: DiffSide,
  source: ContentSource,
  model: ModelBytes | undefined,
  /** Settings already known (the `.meta` being diffed), which are not read again. */
  knownSettings?: ModelImportSettings,
): ModelReadOptions | null {
  const companions = useModelCompanions(place, side, source, model);
  const readSettings = useImportSettings(place, side, source, model !== undefined && knownSettings === undefined);
  // Kept while the known settings stay: new options each render have the model read again, render after render.
  const known = useMemo(() => (knownSettings ? { settings: knownSettings, from: 'meta' as const } : null), [knownSettings]);
  const settings = known ?? readSettings;
  return useMemo(() => (companions && settings ? { companions, settings: settings.settings, settingsFrom: settings.from } : null), [companions, settings]);
}

interface SettingsRead {
  settings: ModelImportSettings;
  from: ImportSettingsSource;
}

const NO_META: SettingsRead = { settings: DEFAULT_IMPORT_SETTINGS, from: 'none' };
const FAILED_READ: SettingsRead = { settings: DEFAULT_IMPORT_SETTINGS, from: 'failed' };

function useImportSettings(place: Place, side: DiffSide, source: ContentSource, wanted: boolean): SettingsRead | null {
  const findSibling = useContext(SiblingFinderContext);
  const path = sourcePathOf(source);
  const fileName = path?.split(/[\\/]/).pop();
  const meta = wanted && path !== null && fileName ? findSibling(side, source, path, `${fileName}.meta`) : null;
  const read = useQuery({
    queryKey: queryKeys.inPlace(place, 'importSettings', meta),
    // A `.meta` that isn't there (outside a Unity project) is an answer, kept as any other: Unity's defaults.
    queryFn: async (): Promise<SettingsRead> => {
      const bytes = await api.content.readBytes(place, meta!);
      return bytes ? { settings: readImportSettings(new TextDecoder().decode(bytes)), from: 'meta' } : NO_META;
    },
    enabled: meta !== null,
    ...(meta && contentCaching([meta])),
  });
  // A version whose sibling finder finds none (a merge's revision; one under an xlink in History) has no `.meta`. A read
  // that failed (the server) shows the defaults meanwhile, and is read again, never kept as the answer.
  if (meta === null) return NO_META;
  if (read.isError) return FAILED_READ;
  return read.data ?? null;
}
