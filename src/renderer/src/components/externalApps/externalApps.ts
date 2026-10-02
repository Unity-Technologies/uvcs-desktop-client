import { useQuery } from '@tanstack/react-query';
import type { ExternalApp, ExternalApps } from '@shared/domain/externalApps';
import { DEFAULT_SETTINGS, type AppSettings } from '@shared/domain/settings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../../app/queryClient';
import { useSettings } from '../../app/settings/useSettings';

export const NO_EXTERNAL_APPS: ExternalApps = { editors: [], terminals: [], editorId: null, terminalId: null };

/** Looked for again after this long (an app may have been installed meanwhile); finding them is one OS lookup. */
const EXTERNAL_APPS_STALE_MS = 60_000;

type AppChoices = Pick<AppSettings, 'editor' | 'terminal' | 'customEditors'>;

/** One list per choice of apps: picking another editor or adding one reads the list again. */
export function externalAppsKey(settings: AppChoices): readonly unknown[] {
  return [...queryKeys.externalApps, settings.editor, settings.terminal, settings.customEditors];
}

function externalAppsQuery(settings: AppChoices) {
  return {
    queryKey: externalAppsKey(settings),
    queryFn: () => api.apps.list(),
    staleTime: EXTERNAL_APPS_STALE_MS,
  };
}

/**
 * The editors and terminals on offer, and the ones "Open in…" uses. Mounted at the root of every window (`App`), which
 * keeps them read for the menus, and read again once stale when the window is focused.
 */
export function useExternalApps(): ExternalApps {
  const { data = NO_EXTERNAL_APPS } = useQuery(externalAppsQuery(useSettings()));
  return data;
}

/** The apps as last read, for menus, which are built when they open and only read; none until `useExternalApps` read them. */
export function currentExternalApps(): ExternalApps {
  const { queryKey } = externalAppsQuery(queryClient.getQueryData<AppSettings>(queryKeys.settings) ?? DEFAULT_SETTINGS);
  return queryClient.getQueryData<ExternalApps>(queryKey) ?? NO_EXTERNAL_APPS;
}

/** The editor "Open in…" uses, if any. */
export function defaultEditor(apps: ExternalApps): ExternalApp | undefined {
  return apps.editors.find((editor) => editor.id === apps.editorId);
}

/** The terminal "Open in…" uses, if any. */
export function defaultTerminal(apps: ExternalApps): ExternalApp | undefined {
  return apps.terminals.find((terminal) => terminal.id === apps.terminalId);
}
