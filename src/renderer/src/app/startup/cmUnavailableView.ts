import type { CmRuntimeStatus } from '@shared/domain/cmRuntime';
import { installedAndNeededText } from '@shared/domain/cmVersionWords';

type ReadyStatus = Extract<CmRuntimeStatus, { kind: 'ready' }>;

/** What the screen says when `cm` doesn't start (`CmUnavailableScreen`), by which `cm` it is. */
export interface CmUnavailableView {
  title: string;
  body: string;
  /** Offers to install Unity Version Control: only when an installed one is what's missing. */
  offersInstall: boolean;
  /** "Installed: 11.0.16.9000 · Needed: 11.0.16.10659 or later" when the installed one is too old; null otherwise. */
  versions: string | null;
}

/**
 * The app's own `cm` was set up and checked, so it isn't missing: something on this computer stops it, and installing
 * another changes nothing. An installed one, or `UVCS_CM_PATH`'s, may simply not be there.
 */
export function cmUnavailableView({ source, installedTooOld }: Pick<ReadyStatus, 'source' | 'installedTooOld'>): CmUnavailableView {
  if (source === 'managed') {
    return {
      title: 'Unity Version Control didn’t start',
      body: 'It’s set up, but didn’t start on this computer, which may block apps in your user folder or lack something they need: the output below says what. Then check again.',
      offersInstall: false,
      versions: null,
    };
  }
  return {
    title: 'Unity Version Control is required',
    body: 'This app works through cm, the Unity Version Control command line client, and it isn’t installed, isn’t on your PATH or is older than this app needs. Install the latest version, then check again: no restart needed.',
    offersInstall: true,
    versions: installedTooOld ? installedAndNeededText(installedTooOld.installed.version, installedTooOld.requiredVersion) : null,
  };
}
