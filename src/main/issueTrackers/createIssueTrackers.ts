import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { safeStorage, session, shell } from 'electron';
import type { IssueTrackerSetup } from '@shared/domain/issueTrackers';
import { GITHUB_OAUTH_CLIENT_IDS } from '@shared/issueTrackers/signInMethods';
import { IssueTrackers } from './IssueTrackers';
import { IssueTrackerStore } from './IssueTrackerStore';
import { realWait } from './signIn/deviceFlow';
import { TrackerHttp, type TrackerFetch, type TrackerRequestLog } from './TrackerHttp';
import { safeStorageCipher, TrackerSecrets } from './TrackerSecrets';

interface TrackersWiring {
  userData: string;
  /** Logs a request in the command log, beside `cm`'s commands. */
  logRequest: (entry: TrackerRequestLog) => void;
  changed: (setup: IssueTrackerSetup) => void;
  /** A development build: it may sign in with its own OAuth app and answer from a fake tracker (below). */
  development: boolean;
  env: NodeJS.ProcessEnv;
}

/**
 * The issue trackers' engine with the app's real edges: the files in the user data folder, the system's keychain and
 * clipboard, and a session of its own for the requests, which sends no cookie (docs/features/issue-trackers.md, "The
 * HTTP client").
 *
 * A development build reads two variables: `UVCS_GITHUB_OAUTH_CLIENT_ID`, an OAuth app of the developer's own for
 * GitHub's device flow, and `UVCS_FAKE_TRACKERS`, a module whose `fetch` answers as the trackers do
 * (`scripts/e2e/fakeTrackers.cjs`), to see the flows with no account. A packaged app reads neither.
 */
export function createIssueTrackers({ userData, logRequest, changed, development, env }: TrackersWiring): IssueTrackers {
  const fake = development && env.UVCS_FAKE_TRACKERS ? env.UVCS_FAKE_TRACKERS : null;
  return new IssueTrackers({
    store: new IssueTrackerStore(join(userData, 'issue-trackers.json')),
    secrets: new TrackerSecrets(join(userData, 'issue-tracker-secrets.json'), safeStorageCipher(safeStorage, process.platform)),
    http: new TrackerHttp({ fetch: fake ? fakeFetch(fake) : sessionFetch(), log: logRequest }),
    changed,
    newId: randomUUID,
    now: Date.now,
    wait: realWait,
    // Against the fake trackers, a token page would be a real tracker's: it's named in the console instead.
    openExternal: (url) => (fake ? console.log(`[fake trackers] the token page: ${url}`) : void shell.openExternal(url)),
    oauthClientIds: development && env.UVCS_GITHUB_OAUTH_CLIENT_ID ? { ...GITHUB_OAUTH_CLIENT_IDS, 'github.com': env.UVCS_GITHUB_OAUTH_CLIENT_ID } : GITHUB_OAUTH_CLIENT_IDS,
  });
}

/** The requests' own session, kept in memory (no `persist:`), made at the first request, once Electron is ready. */
function sessionFetch(): TrackerFetch {
  let fetchIn: TrackerFetch | null = null;
  return (url, init) => {
    fetchIn ??= (address, options) => session.fromPartition('issue-trackers').fetch(address, options);
    return fetchIn(url, init);
  };
}

function fakeFetch(modulePath: string): TrackerFetch {
  const fake = createRequire(__filename)(modulePath) as { fetch: TrackerFetch };
  return fake.fetch;
}
