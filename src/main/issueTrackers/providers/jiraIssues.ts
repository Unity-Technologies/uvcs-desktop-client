import type { Issue, IssueRead, IssueStatusCategory, TrackerAccount } from '@shared/domain/issueTrackers';
import { isRecord, stringOf } from './IssueTrackerProvider';

/** The fields a chip shows, all a read asks for. */
export const JIRA_ISSUE_FIELDS = ['summary', 'status', 'issuetype', 'assignee'];

/**
 * Jira's three status categories as the app's four: Jira has no canceled one ("Won't Do" is done), and a status read
 * without one is to do.
 */
export function jiraStatusCategory(key: string | undefined): IssueStatusCategory {
  switch (key) {
    case 'indeterminate':
      return 'inProgress';
    case 'done':
      return 'done';
    default:
      return 'todo';
  }
}

/** A user as Jira's REST API v3 gives one (`myself`, an issue's assignee). */
export function jiraAccount(user: unknown): TrackerAccount | null {
  if (!isRecord(user)) return null;
  const id = stringOf(user.accountId) ?? stringOf(user.name) ?? '';
  const name = stringOf(user.displayName) ?? id;
  const email = stringOf(user.emailAddress);
  return { id, name, ...(email && { email }) };
}

/** An issue as `bulkfetch` gives one. */
export function jiraIssue(raw: unknown, site: string): Issue | null {
  if (!isRecord(raw) || !isRecord(raw.fields)) return null;
  const key = stringOf(raw.key);
  if (!key) return null;
  const { fields } = raw;
  const status = isRecord(fields.status) ? fields.status : {};
  const category = isRecord(status.statusCategory) ? stringOf(status.statusCategory.key) : undefined;
  return {
    key,
    title: stringOf(fields.summary) ?? '',
    status: stringOf(status.name) ?? '',
    statusCategory: jiraStatusCategory(category),
    type: isRecord(fields.issuetype) ? (stringOf(fields.issuetype.name) ?? '') : '',
    assignee: jiraAccount(fields.assignee),
    url: `${site}/browse/${key}`,
  };
}

/**
 * What `POST /rest/api/3/issue/bulkfetch` answered for each key asked, in their order. A key it left out is missing (no
 * such issue, or one the account can't see: Jira doesn't tell them apart); with `issueErrors`, which name issues by id
 * only, the keys left out may be those, so they're unreadable this time.
 */
export function jiraIssueReads(body: Record<string, unknown>, keys: readonly string[], site: string): IssueRead[] {
  const issues = Array.isArray(body.issues) ? body.issues : [];
  const byKey = new Map<string, Issue>();
  for (const raw of issues) {
    const issue = jiraIssue(raw, site);
    if (issue) byKey.set(issue.key, issue);
  }
  const someFailed = Array.isArray(body.issueErrors) && body.issueErrors.length > 0;
  return keys.map((key): IssueRead => {
    const issue = byKey.get(key);
    if (issue) return { key, kind: 'found', issue };
    return someFailed ? { key, kind: 'unreadable', reason: 'unexpected' } : { key, kind: 'missing' };
  });
}
