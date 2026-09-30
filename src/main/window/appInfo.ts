import { app } from 'electron';
import type { AppInfo } from '@shared/domain/appUpdate';
import { REPOSITORY_URL } from '../update/releaseFeed';

export const DOCUMENTATION_URL = 'https://docs.unity.com/ugs/en-us/manual/devops/manual';

/** What the About dialog shows of the running app. */
export function appInfo(): AppInfo {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    documentationUrl: DOCUMENTATION_URL,
    issuesUrl: `${REPOSITORY_URL}/issues/new`,
  };
}
