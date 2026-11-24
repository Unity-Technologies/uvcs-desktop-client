import type { CmRuntimeApi } from '@shared/api/cmRuntime';
import type { ServiceContext } from './ServiceContext';

export function createCmRuntimeService({ cmRuntime }: ServiceContext): CmRuntimeApi {
  return {
    status: async () => cmRuntime.status(),
    retry: async () => cmRuntime.retry(),
    use: async (choice) => cmRuntime.use(choice),
    useIncludedForNow: async () => cmRuntime.useIncludedForNow(),
    checkInstalledAgain: () => cmRuntime.checkInstalledAgain(),
    installedCm: () => cmRuntime.installedCm(),
    reveal: async () => cmRuntime.revealCm(),
    pinnedVersion: async () => (cmRuntime.hasOwnCm() ? cmRuntime.pinnedVersion : null),
  };
}
