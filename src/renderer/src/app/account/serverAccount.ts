import type { Account } from '@shared/domain/account';
import { cloudOrganization, isCloudServer } from '../../lib/servers';

const sameName = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Genesis organization ids are numeric (`1375488836673@cloud`); older organizations only have a name. */
const isGenesisId = (organization: string): boolean => /^\d/.test(organization);

/** The cloud organizations named by these servers, e.g. `acme` and its genesis id `1375488836673`. */
function organizationsIn(servers: (string | undefined)[]): string[] {
  return servers.flatMap((server) => (server && cloudOrganization(server)) || []);
}

const organizationsOf = (server: string, account?: Account): string[] => organizationsIn([account?.server, account?.name, server]);

/**
 * The profile `cm` signs in with on `server`, resolved the way `cm` does: the server's own profile (a cloud
 * organization matches by name or genesis id), else `*@cloud` for cloud servers. `cm` keeps one profile per server,
 * so there is never more than one candidate.
 */
export function accountForServer(accounts: Account[], server: string): Account | undefined {
  const own = accounts.find((account) => sameName(account.server, server) || sameName(account.name, server));
  if (own) return own;
  const organization = cloudOrganization(server);
  if (!organization) return undefined;
  return (
    accounts.find((account) => organizationsIn([account.server, account.name]).some((name) => sameName(name, organization))) ??
    accounts.find((account) => account.server.startsWith('*@'))
  );
}

/** The cloud organization's readable name (`acme`, not its genesis id), or null for on-premises servers. */
export function organizationName(server: string, account?: Account): string | null {
  const organizations = organizationsOf(server, account);
  return organizations.find((name) => !isGenesisId(name)) ?? organizations[0] ?? null;
}

const DASHBOARD_ORGANIZATIONS = 'https://cloud.unity.com/home/organizations';

const genesisIdOf = (server: string, account?: Account): string | undefined => organizationsOf(server, account).find(isGenesisId);

/** Where the dashboard lists Unity Version Control organizations: under the genesis organization when known. */
const dashboardOrganizations = (genesisId: string | undefined): string =>
  genesisId
    ? `${DASHBOARD_ORGANIZATIONS}/${genesisId}/projects/default/plastic-scm/organizations`
    : `${DASHBOARD_ORGANIZATIONS}/default/plastic-scm/organizations`;

/**
 * The Unity Cloud dashboard, built like the official client does (UnityUrl.UnityDashboard): straight into the
 * organization when its genesis id is known, otherwise the dashboard picks it.
 */
export function cloudDashboardUrl(server: string, account?: Account): string {
  return dashboardOrganizations(genesisIdOf(server, account));
}

/** The port every on-premises server's web admin listens on, as the official client assumes. */
const WEB_ADMIN_PORT = 7178;

/** `ssl://host:8088` → `host`, `[::1]:8087` → `[::1]`: the host alone, for the server's web admin. */
function serverHost(server: string): string {
  const address = server.replace(/^[a-z]+:\/\//i, '');
  if (address.startsWith('[')) return address.slice(0, address.indexOf(']') + 1);
  return address.split(':')[0];
}

/**
 * The page where the server's lock rules are edited (which files lock on checkout, and the branches they don't lock
 * on), as the official client opens it (OpenConfigureLockRulesPage): the organization's page in the Unity Cloud
 * dashboard, or an on-premises server's web admin. No `cm` command reads or writes lock rules, so the app offers the
 * page rather than a dialog of its own. Null where there are none to edit: the local server, which only this
 * computer uses.
 */
export function lockRulesUrl(server: string, account?: Account): string | null {
  if (server === 'local') return null;
  if (!isCloudServer(server)) return `http://${serverHost(server)}:${WEB_ADMIN_PORT}/configuration/lock-rules`;
  const genesisId = genesisIdOf(server, account);
  const organization = genesisId ?? cloudOrganization(server);
  return organization ? `${dashboardOrganizations(genesisId)}/${encodeURIComponent(organization)}/lock-rules` : null;
}

const SIGN_IN_METHODS: Record<string, string> = {
  SSOWorkingMode: 'Single sign-on',
  LDAPWorkingMode: 'LDAP',
  ADWorkingMode: 'Active Directory',
  UPWorkingMode: 'User and password',
  NameWorkingMode: 'User name',
};

/** `SSOWorkingMode` → `Single sign-on`. */
export function signInMethod(workingMode: string): string {
  return SIGN_IN_METHODS[workingMode] ?? workingMode.replace(/WorkingMode$/, '');
}
