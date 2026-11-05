import type { IssueTrackerKind } from '@shared/domain/issueTrackers';
import { githubProvider } from './github';
import type { IssueTrackerProvider } from './IssueTrackerProvider';
import { jiraCloudProvider } from './jiraCloud';
import { jiraDataCenterProvider } from './jiraDataCenter';

/** Every tracker's provider, by kind: a new kind doesn't compile until it has one. */
export const TRACKER_PROVIDERS: Readonly<Record<IssueTrackerKind, IssueTrackerProvider>> = {
  jiraCloud: jiraCloudProvider,
  jiraDataCenter: jiraDataCenterProvider,
  github: githubProvider,
};
