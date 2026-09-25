import type { SettingsApi } from '@shared/api/settings';
import type { ServiceContext } from './ServiceContext';

export function createSettingsService({ settings }: ServiceContext): SettingsApi {
  return {
    get: async () => settings.get(),
    update: async (changes) => settings.update(changes),
  };
}
