import type { UpdateStatus } from '@shared/domain/appUpdate';
import { installLabel } from '../updates/updateCardStatus';

export type AboutUpdateTone = 'muted' | 'accent' | 'error';

export interface AboutUpdateLine {
  text: string;
  tone: AboutUpdateTone;
  /** Something is under way: the line shows a spinner. */
  busy: boolean;
}

/** The About dialog's line on where the update stands. */
export function aboutUpdateLine(status: UpdateStatus): AboutUpdateLine {
  switch (status.state) {
    case 'idle':
      return { text: 'Updates download by themselves.', tone: 'muted', busy: false };
    case 'checking':
      return { text: 'Checking for updates…', tone: 'muted', busy: true };
    case 'upToDate':
      return { text: "You're on the latest version.", tone: 'muted', busy: false };
    case 'downloading':
      return { text: `Downloading version ${status.version}… ${status.percent}%`, tone: 'accent', busy: true };
    case 'ready':
      return status.install === 'restart'
        ? { text: `Version ${status.version} is ready to install.`, tone: 'accent', busy: false }
        : { text: `Version ${status.version} is downloaded. Open its installer to finish.`, tone: 'accent', busy: false };
    case 'failed':
      return { text: `Couldn't check for updates: ${status.error}`, tone: 'error', busy: false };
    case 'unavailable':
      return { text: 'Development builds don’t update.', tone: 'muted', busy: false };
  }
}

export type AboutUpdateAction = { kind: 'check'; enabled: boolean } | { kind: 'install'; label: string };

/** The About dialog's button: installing a downloaded update, or checking, which waits while one is under way. */
export function aboutUpdateAction(status: UpdateStatus): AboutUpdateAction {
  if (status.state === 'ready') return { kind: 'install', label: installLabel(status.install) };
  const enabled = status.state !== 'checking' && status.state !== 'downloading' && status.state !== 'unavailable';
  return { kind: 'check', enabled };
}

const OS_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

/** The OS and architecture, as people name them ("macOS · arm64"). */
export function describePlatform(platform: string, arch: string): string {
  return `${OS_NAMES[platform] ?? platform} · ${arch}`;
}
