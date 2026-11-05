import { describe, expect, it } from 'vitest';
import { ALLOW, hostConsentQuestion } from './hostConsentQuestion';

describe('hostConsentQuestion', () => {
  it('names the host plainly, Cancel the default and the answer to Escape', () => {
    expect(hostConsentQuestion('https://git.acme.com', 'github')).toEqual({
      type: 'question',
      message: 'Sign in to git.acme.com?',
      detail: "Your token will be sent to git.acme.com. Sign in only if it's your company's GitHub Enterprise Server.",
      buttons: ['Sign In', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    expect(ALLOW).toBe(0);
  });

  it('names the product the server is meant to be: a company’s Jira for Data Center', () => {
    expect(hostConsentQuestion('https://jira.acme.com', 'jiraDataCenter')).toMatchObject({
      message: 'Sign in to jira.acme.com?',
      detail: "Your token will be sent to jira.acme.com. Sign in only if it's your company's Jira.",
    });
  });

  it('keeps a port, and shows a look-alike in punycode', () => {
    expect(hostConsentQuestion('https://git.acme.com:8443', 'github').message).toBe('Sign in to git.acme.com:8443?');
    expect(hostConsentQuestion('https://gіthub.com', 'github').message).toBe('Sign in to xn--gthub-n2e.com?');
  });
});
