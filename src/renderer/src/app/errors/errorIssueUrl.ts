import type { FailedCommand } from '@shared/ipc';
import { bugReportUrl } from '@shared/issueForms';
import { aboutDetails } from '../about/aboutDetails';
import type { ReportingAppInfo } from '../about/aboutIssueUrls';
import { errorReport } from './errorReport';

export interface ReportedError {
  /** What failed, as the error dialog titles it: "Checkin failed". */
  title: string;
  message: string;
  command: FailedCommand;
}

/**
 * The bug report form on the error the dialog shows: titled with what failed, with the app's details (what About ▸
 * Copy Details gives) and the error as the dialog's Copy gives it. Main already hid its secrets (`hideSecrets`); the
 * user reviews the rest, paths included, in the browser before sending it.
 */
export function errorIssueUrl(info: ReportingAppInfo, cmVersion: string | undefined, error: ReportedError): string {
  return bugReportUrl(info.issuesUrl, {
    title: `${error.title}: ${error.message}`,
    appDetails: aboutDetails(info, cmVersion),
    errorDetails: errorReport(error.title, error.message, error.command),
  });
}
