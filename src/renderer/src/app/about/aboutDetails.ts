import type { AppInfo } from '@shared/domain/appUpdate';
import { APP_NAME } from '../../lib/appIdentity';
import { describePlatform } from './aboutUpdate';

/**
 * What the About dialog's Copy details button copies: the version and what the app runs on, one "Name: value" per line,
 * ready to paste into an issue. `cmVersion` is undefined while `cm version` hasn't answered.
 */
export function aboutDetails(info: Pick<AppInfo, 'version' | 'platform' | 'arch' | 'electron' | 'chromium'>, cmVersion: string | undefined): string {
  return [
    `${APP_NAME}: ${info.version}`,
    `cm: ${cmVersion ?? 'unknown'}`,
    `Platform: ${describePlatform(info.platform, info.arch)}`,
    `Electron: ${info.electron}`,
    `Chromium: ${info.chromium}`,
  ].join('\n');
}
