import type { Account } from '@shared/domain/account';
import { lockRulesUrl } from '../../app/account/serverAccount';
import { isCloudServer } from '../../lib/servers';

/** Where the server's lock rules are edited, and the words that say so before the user leaves the app for it. */
export interface LockRulesPage {
  url: string;
  tip: string;
}

/** The lock rules page of `server` (`lockRulesUrl`), or null where the server has none. */
export function lockRulesPage(server: string, account?: Account): LockRulesPage | null {
  const url = lockRulesUrl(server, account);
  if (!url) return null;
  const where = isCloudServer(server) ? 'in the Unity Cloud dashboard' : "in the server's web admin";
  return { url, tip: `Choose which files lock when someone checks them out, ${where}` };
}
