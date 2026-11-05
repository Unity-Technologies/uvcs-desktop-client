import type { IssueTrackerKind } from '@shared/domain/issueTrackers';

/** The OS message box's options main asks with (Electron's `MessageBoxOptions`, the part it uses). */
export interface HostConsentQuestion {
  type: 'question';
  message: string;
  detail: string;
  buttons: string[];
  defaultId: number;
  cancelId: number;
  noLink: true;
}

/** The answer that allows: the first button. Cancel, Escape and closing the box answer the other. */
export const ALLOW = 0;

/** What a self-hosted server of each kind is meant to be, as the question names it. */
const SELF_HOSTED: Readonly<Record<IssueTrackerKind, string>> = {
  github: 'GitHub Enterprise Server',
  jiraDataCenter: 'Jira',
  jiraCloud: 'Jira',
};

/**
 * Main's question before a credential first goes to a host no tracker is known by (`needsHostConsent`): the host as the
 * address names it, port and punycode kept (`xn--…`), so a look-alike shows as what it is, and what it's meant to be
 * (a company's Jira, its GitHub Enterprise Server). Cancel is the default.
 */
export function hostConsentQuestion(server: string, kind: IssueTrackerKind): HostConsentQuestion {
  const host = new URL(server).host;
  return {
    type: 'question',
    message: `Sign in to ${host}?`,
    detail: `Your token will be sent to ${host}. Sign in only if it's your company's ${SELF_HOSTED[kind]}.`,
    buttons: ['Sign In', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  };
}
