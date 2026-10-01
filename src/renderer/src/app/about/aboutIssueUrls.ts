import type { AppInfo } from '@shared/domain/appUpdate';
import { BUG_REPORT_FORM, FEATURE_REQUEST_FORM, issueFormUrl } from '@shared/issueForms';
import { aboutDetails } from './aboutDetails';

/** What an issue form needs of the app: where issues open, and what About ▸ Copy Details lists. */
export type ReportingAppInfo = Parameters<typeof aboutDetails>[0] & Pick<AppInfo, 'issuesUrl'>;

/** About's Report an Issue: the bug report form with the app's details already in, as Copy Details gives them. */
export function aboutBugReportUrl(info: ReportingAppInfo, cmVersion: string | undefined): string {
  return issueFormUrl(info.issuesUrl, BUG_REPORT_FORM.template, { fields: [[BUG_REPORT_FORM.appDetails, aboutDetails(info, cmVersion)]] });
}

/** About's Request a Feature: the feature request form, empty. */
export function featureRequestUrl(info: Pick<AppInfo, 'issuesUrl'>): string {
  return issueFormUrl(info.issuesUrl, FEATURE_REQUEST_FORM.template);
}
