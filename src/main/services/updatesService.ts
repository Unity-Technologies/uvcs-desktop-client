import type { UpdatesApi } from '@shared/api/updates';
import { appInfo } from '../window/appInfo';
import type { ServiceContext } from './ServiceContext';

export function createUpdatesService({ updates }: ServiceContext): UpdatesApi {
  return {
    appInfo: async () => appInfo(),
    status: async () => updates.status(),
    check: () => updates.check(),
    releaseNotes: async () => updates.releaseNotes(),
    install: () => updates.install(),
  };
}
