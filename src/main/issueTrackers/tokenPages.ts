import type { TokenPageChoice } from '@shared/api/issueTrackers';
import type { IssueTrackerKind } from '@shared/domain/issueTrackers';
import { JIRA_DATA_CENTER_TOKEN_PAGES, type DataCenterTokenPage } from '@shared/issueTrackers/grammars/jiraDataCenter';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import { TrackerError } from './TrackerError';
import type { TrackerHttp } from './TrackerHttp';

/**
 * Which page a Jira Data Center makes tokens on, from how its API Token Authentication servlet answered a request with
 * no credential: a 401 (or a 200) means the app is there, a redirect to the login page (`login`) or anything else means
 * it isn't, and Jira's own Personal Access Tokens page is the one.
 */
export function dataCenterTokenPage(answer: number | 'login' | null): DataCenterTokenPage {
  return answer === 401 || answer === 200 ? 'apiTokenApp' : 'jira';
}

/**
 * The token page "Create a token" opens (docs/features/issue-trackers.md, "The token"): the tracker's one page, or for
 * Jira Data Center the one its server has, found by one request with no credential (so no host consent) through
 * `TrackerHttp`, once per server while the app runs. "Other token page" opens the other one, so a wrong guess never
 * strands anyone.
 */
export class TokenPages {
  private readonly found = new Map<string, Promise<DataCenterTokenPage>>();

  constructor(private readonly http: TrackerHttp) {}

  async urlOf(tracker: { kind: IssueTrackerKind; server: string }, choice: TokenPageChoice): Promise<string> {
    if (tracker.kind !== 'jiraDataCenter') return TRACKER_GRAMMARS[tracker.kind].tokenPageUrl(tracker.server);
    const found = await this.pageOf(tracker.server);
    const page = choice === 'other' ? otherPage(found) : found;
    return JIRA_DATA_CENTER_TOKEN_PAGES[page](tracker.server);
  }

  private pageOf(server: string): Promise<DataCenterTokenPage> {
    const key = server.toLowerCase();
    const known = this.found.get(key);
    if (known) return known;
    const asked = this.ask(server).then(dataCenterTokenPage);
    this.found.set(key, asked);
    return asked;
  }

  private async ask(server: string): Promise<number | 'login' | null> {
    const url = JIRA_DATA_CENTER_TOKEN_PAGES.apiTokenApp(server);
    try {
      return (await this.http.bound([new URL(url).origin], null).send({ method: 'GET', url })).status;
    } catch (error) {
      if (!(error instanceof TrackerError) || error.reason !== 'signInRefused') return null;
      return error.toLogin ? 'login' : 401;
    }
  }
}

function otherPage(page: DataCenterTokenPage): DataCenterTokenPage {
  return page === 'jira' ? 'apiTokenApp' : 'jira';
}
