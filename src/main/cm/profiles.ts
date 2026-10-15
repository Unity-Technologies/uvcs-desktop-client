import type { Account } from '@shared/domain/account';
import type { ServerProfile } from '@shared/domain/repository';

const LOCAL_SERVER = 'local';

/** The servers the profiles sign in to (server, user, working mode), the local one first, skipping wildcards such as `*@cloud`. */
export function serverProfiles(accounts: readonly Account[]): ServerProfile[] {
  const profiles = accounts
    .map(({ server, user, workingMode }) => ({ server, user, workingMode }))
    .filter((profile) => profile.server && !profile.server.includes('*'));

  const unique = [...new Map(profiles.map((profile) => [profile.server, profile])).values()];
  const withoutLocal = unique.filter((profile) => profile.server !== LOCAL_SERVER);
  return [{ server: LOCAL_SERVER, user: '', workingMode: '' }, ...withoutLocal];
}
