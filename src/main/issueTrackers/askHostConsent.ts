import { BrowserWindow, dialog } from 'electron';
import type { IssueTrackerKind } from '@shared/domain/issueTrackers';
import { currentCaller } from '../ipc/caller';
import { ALLOW, hostConsentQuestion } from './hostConsentQuestion';

/**
 * Asks, over the window whose sign-in it is, whether a credential may go to a host no tracker is known by
 * (`needsHostConsent`, docs/features/issue-trackers.md "Host consent"). The OS's own message box, as closing with work
 * running asks (`askToCloseWhenDone`): only the user answers it, never the window. Cancel, Escape and closing it decline.
 */
export async function askHostConsent(server: string, kind: IssueTrackerKind): Promise<boolean> {
  const caller = currentCaller();
  const window = caller ? BrowserWindow.fromWebContents(caller) : null;
  const question = hostConsentQuestion(server, kind);
  const { response } = window ? await dialog.showMessageBox(window, question) : await dialog.showMessageBox(question);
  return response === ALLOW;
}
