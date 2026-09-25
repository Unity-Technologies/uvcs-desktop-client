import type { Account } from '@shared/domain/account';
import { cloudOrganization } from '../../lib/servers';

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

/**
 * The Unity Cloud dashboard, built like the official client does (UnityUrl.UnityDashboard): straight into the
 * organization when its genesis id is known, otherwise the dashboard picks it.
 */
export function cloudDashboardUrl(server: string, account?: Account): string {
  const genesisId = organizationsOf(server, account).find(isGenesisId);
  return genesisId
    ? `${DASHBOARD_ORGANIZATIONS}/${genesisId}/projects/default/plastic-scm/organizations`
    : `${DASHBOARD_ORGANIZATIONS}/default/plastic-scm/organizations`;
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
