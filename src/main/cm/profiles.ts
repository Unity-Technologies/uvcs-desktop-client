import type { ServerProfile } from '@shared/domain/repository';
import { parseRecords } from './formatRecords';

const LOCAL_SERVER = 'local';

/** Parses `cm profile list` records (server, user, working mode), skipping wildcard profiles such as `*@cloud`. */
export function parseProfiles(output: string): ServerProfile[] {
  const profiles = parseRecords(output)
    .map(([server = '', user = '', workingMode = '']) => ({ server, user, workingMode }))
    .filter((profile) => profile.server && !profile.server.includes('*'));

  const unique = [...new Map(profiles.map((profile) => [profile.server, profile])).values()];
  const withoutLocal = unique.filter((profile) => profile.server !== LOCAL_SERVER);
  return [{ server: LOCAL_SERVER, user: '', workingMode: '' }, ...withoutLocal];
}
