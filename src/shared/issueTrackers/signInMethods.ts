import type { IssueTrackerKind, SignInMethodKind } from '../domain/issueTrackers';

/**
 * The OAuth apps the device flow signs in with, by the host they're registered on: a client id is public (the device
 * flow needs no secret), so it ships with the app. A host whose id is empty isn't offered the device flow, only a
 * token. The app keeps no refresh token, so the OAuth app's "Expire user access tokens" stays off
 * (docs/features/issue-trackers.md, "The device flow").
 */
export const GITHUB_OAUTH_CLIENT_IDS: Readonly<Record<string, string>> = {
  'github.com': 'Ov23li9k9uyuCxbsWJSa',
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
    // A personal access token. Browser sign-in (OAuth) would need an application link each site's admin sets up: a
    // `browser` method joins here once it's offered.
    case 'jiraDataCenter':
      return ['token'];
  }
}
