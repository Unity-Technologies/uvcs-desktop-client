import { app } from 'electron';
import type { AppInfo } from '@shared/domain/appUpdate';
import { BUG_REPORT_FORM, FEATURE_REQUEST_FORM, issueFormUrl } from '@shared/issueForms';
import { REPOSITORY_URL } from '../update/releaseFeed';

export const DOCUMENTATION_URL = 'https://docs.unity.com/en-us/unity-version-control';

/** Where a problem is reported: a new issue in the app's repository. */
export const ISSUES_URL = `${REPOSITORY_URL}/issues/new`;
/** Help ▸ Report an Issue and Request a Feature: the repository's issue forms, empty. */
export const BUG_REPORT_URL = issueFormUrl(ISSUES_URL, BUG_REPORT_FORM.template);
export const FEATURE_REQUEST_URL = issueFormUrl(ISSUES_URL, FEATURE_REQUEST_FORM.template);

/** What the About dialog shows of the running app. */
export function appInfo(): AppInfo {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    documentationUrl: DOCUMENTATION_URL,
    issuesUrl: ISSUES_URL,
  };
}
