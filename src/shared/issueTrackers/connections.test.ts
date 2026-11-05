import { describe, expect, it } from 'vitest';
import { coveringConnection, needsHostConsent } from './connections';

const github = (id: string, scope: string) => ({ id, kind: 'github' as const, server: 'https://github.com', scope });

describe('coveringConnection', () => {
  it('takes a GitHub repository’s owner’s connection first, then one for every owner', () => {
    const connections = [github('all', '*'), github('acme', 'acme'), github('other', 'other')];
    expect(coveringConnection(connections, 'github', 'https://github.com', 'acme/game')?.id).toBe('acme');
    expect(coveringConnection(connections, 'github', 'https://github.com', 'third/tools')?.id).toBe('all');
    expect(coveringConnection([github('other', 'other')], 'github', 'https://github.com', 'acme/game')).toBeUndefined();
  });

  it('takes a Jira site’s connection for any of its projects, and none of another site', () => {
    const jira = { id: 'j', kind: 'jiraCloud' as const, server: 'https://acme.atlassian.net' };
    expect(coveringConnection([jira], 'jiraCloud', 'https://acme.atlassian.net', 'OPS')?.id).toBe('j');
    expect(coveringConnection([jira], 'jiraCloud', 'https://other.atlassian.net', 'OPS')).toBeUndefined();
  });
});

describe('needsHostConsent', () => {
  it('asks nothing for the trackers’ own hosts', () => {
    for (const server of ['https://github.com', 'https://octo.ghe.com', 'https://acme.atlassian.net', 'https://acme.jira.com']) expect(needsHostConsent(server, [])).toBe(false);
  });

  it('asks before sending a credential to any other host, but not to one a connection already signs in to', () => {
    expect(needsHostConsent('https://git.acme.com', [])).toBe(true);
    expect(needsHostConsent('https://evil.example', [github('a', '*')])).toBe(true);
    expect(needsHostConsent('https://git.acme.com', [{ ...github('e', '*'), server: 'https://GIT.acme.com' }])).toBe(false);
  });

  it('reads a tracker’s host in any case, and a host with a trailing dot as another host', () => {
    expect(needsHostConsent('https://GitHub.com', [])).toBe(false);
    expect(needsHostConsent('https://ACME.Atlassian.net', [])).toBe(false);
    expect(needsHostConsent('https://github.com.', [])).toBe(true);
  });

  it('never takes a look-alike for a tracker’s host', () => {
    expect(needsHostConsent('https://github.com.evil.example', [])).toBe(true);
    expect(needsHostConsent('https://atlassian.net.evil.example', [])).toBe(true);
  });
});
