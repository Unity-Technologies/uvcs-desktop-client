import { app, shell } from 'electron';
import type { UpdatesApi } from '@shared/api/updates';
import { appInfo } from '../window/appInfo';
import { thirdPartyNoticesPath } from '../window/thirdPartyNoticesPath';
import type { ServiceContext } from './ServiceContext';

export function createUpdatesService({ updates }: ServiceContext): UpdatesApi {
  return {
    appInfo: async () => appInfo(),
    status: async () => updates.status(),
    check: () => updates.check(),
    releaseNotes: async () => updates.releaseNotes(),
    install: () => updates.install(),
    openThirdPartyNotices: async () => {
      const error = await shell.openPath(thirdPartyNoticesPath({ isPackaged: app.isPackaged, resourcesPath: process.resourcesPath, appPath: app.getAppPath() }));
      if (error) throw new Error(error);
    },
  };
}
