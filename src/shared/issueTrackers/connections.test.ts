import { describe, expect, it } from 'vitest';
import { coveringConnection } from './connections';

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
