import type { IssueTrackerKind, SignInMethodKind } from '../domain/issueTrackers';

/**
 * The OAuth apps the device flow signs in with, by the host they're registered on: a client id is public (the device
 * flow needs no secret), so it ships with the app. Empty until the app is registered: GitHub's device flow is then not
 * offered, and a token is.
 */
export const GITHUB_OAUTH_CLIENT_IDS: Readonly<Record<string, string>> = {
  'github.com': '',
};

/** The scopes the device flow asks for: `repo`, as GitHub has no narrower scope that reads a private repository's issues. */
export const GITHUB_OAUTH_SCOPES = 'repo';

/** The hosts whose device flow has a client id: the app's, or a development build's own (`UVCS_GITHUB_OAUTH_CLIENT_ID`). */
export function deviceFlowHostsOf(clientIds: Readonly<Record<string, string>>): string[] {
  return Object.entries(clientIds)
    .filter(([, clientId]) => clientId !== '')
    .map(([host]) => host);
}

/**
 * The ways to sign in to a tracker's server, the best first (docs/features/issue-trackers.md, "Sign-in"): GitHub's
 * device flow where an app is registered for the host, else a token; Jira Cloud's API token, until its browser sign-in
 * has a token exchange to use (Atlassian's OAuth needs a client secret).
 */
export function signInMethodsFor(kind: IssueTrackerKind, server: string, deviceFlowHosts: readonly string[]): SignInMethodKind[] {
  switch (kind) {
    case 'github':
      return deviceFlowHosts.includes(new URL(server).hostname.toLowerCase()) ? ['deviceCode', 'token'] : ['token'];
    case 'jiraCloud':
      return ['token'];
  }
}
