import type { CmRuntimeApi } from '@shared/api/cmRuntime';
import type { ServiceContext } from './ServiceContext';

export function createCmRuntimeService({ cmRuntime }: ServiceContext): CmRuntimeApi {
  return {
    status: async () => cmRuntime.status(),
    retry: async () => cmRuntime.retry(),
    use: async (choice) => cmRuntime.use(choice),
    installedCm: () => cmRuntime.installedCm(),
    pinnedVersion: async () => (cmRuntime.hasOwnCm() ? cmRuntime.pinnedVersion : null),
  };
}
