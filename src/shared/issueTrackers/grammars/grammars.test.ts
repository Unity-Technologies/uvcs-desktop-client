import { describe, expect, it } from 'vitest';
import { githubApiBase, githubGrammar, githubGraphqlUrl, githubKeyParts } from './github';
import { jiraCloudGrammar } from './jiraCloud';
import { jiraDataCenterGrammar } from './jiraDataCenter';

const keysIn = (text: string, projects: string[]) => jiraCloudGrammar.referencesReader(projects)(text).map(({ key, from, to }) => ({ key, from, to }));
const githubIn = (text: string, projects: string[]) => githubGrammar.referencesReader(projects)(text).map(({ key, bare, source }) => ({ key, bare, source }));

describe('Jira Cloud references', () => {
  it('reads a bound project’s keys, where they start and end', () => {
    expect(keysIn('Fixes VCS-12 and (VCS-1009139).', ['VCS'])).toEqual([
      { key: 'VCS-12', from: 6, to: 12 },
      { key: 'VCS-1009139', from: 18, to: 29 },
    ]);
  });

  it('reads no key of another project: UTF-8 and ISO-8859 aren’t issues', () => {
    expect(keysIn('ABC-123 in UTF-8 or ISO-8859', ['VCS'])).toEqual([]);
  });

  it('reads none inside a word, a path or an address, nor with a leading zero', () => {
    expect(keysIn('scmVCS-12 /a/VCS-12 x.VCS-12 VCS-012 VCS-12x VCS-12_fix', ['VCS'])).toEqual([]);
  });

  it('reads a key written with `#` before it, the `#` part of it, as a picked issue writes it', () => {
    expect(jiraCloudGrammar.referencesReader(['VCS'])('Fixes #VCS-12.').map(({ key, source, from, to }) => ({ key, source, from, to }))).toEqual([{ key: 'VCS-12', source: '#VCS-12', from: 6, to: 13 }]);
    // Never after a word or another `#`: `C#VCS-1` and `##VCS-1` are no references.
    expect(keysIn('C#VCS-1 ##VCS-1', ['VCS'])).toEqual([]);
  });

  it('reads a key in emphasis', () => {
    expect(keysIn('_VCS-12_ and **VCS-13**', ['VCS']).map(({ key }) => key)).toEqual(['VCS-12', 'VCS-13']);
  });

  it('reads none with no project bound', () => {
    expect(keysIn('VCS-12', [])).toEqual([]);
  });

  it('tells a token by its shape', () => {
    expect(jiraCloudGrammar.tokenShape(`ATATT3xFfGF0${'a'.repeat(180)}`)).toBe('known');
    expect(jiraCloudGrammar.tokenShape('abcdefghijklmnopqrstuvwx')).toBe('plausible');
    expect(jiraCloudGrammar.tokenShape('not a token')).toBe('none');
  });
});

describe('Jira Data Center', () => {
  it('reads a bound project’s keys as Jira Cloud does', () => {
    expect(jiraDataCenterGrammar.referencesReader(['VCS'])('Fixes VCS-12, not UTF-8').map(({ key }) => key)).toEqual(['VCS-12']);
  });

  it('opens issues and the personal access tokens page under the server, its context path kept', () => {
    expect(jiraDataCenterGrammar.issueUrl('https://tools.acme.com/jira', 'OPS-7')).toBe('https://tools.acme.com/jira/browse/OPS-7');
    expect(jiraDataCenterGrammar.tokenPageUrl('https://jira.unity3d.com')).toBe(
      'https://jira.unity3d.com/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens',
    );
  });

  it('takes a 44-character base64 token as plausible, never as a known shape that signs in on paste', () => {
    expect(jiraDataCenterGrammar.tokenShape('fake-data-center-token-for-tests-0123456789')).toBe('plausible');
    expect(jiraDataCenterGrammar.tokenShape('short')).toBe('none');
    expect(jiraDataCenterGrammar.tokenShape('has spaces in it, not a token at all')).toBe('none');
  });
});

describe('GitHub references', () => {
  it('reads `#12` as the bound repository’s, when only one is bound', () => {
    expect(githubIn('Fixes #12.', ['acme/game'])).toEqual([{ key: 'acme/game#12', bare: true, source: '#12' }]);
    expect(githubIn('Fixes #12.', ['acme/game', 'acme/tools'])).toEqual([]);
  });

  it('reads `owner/repo#12` of any repository, in lower case', () => {
    expect(githubIn('See Acme/Tools#4.', ['acme/game'])).toEqual([{ key: 'acme/tools#4', bare: false, source: 'Acme/Tools#4' }]);
  });

  it('reads no `#` in an entity, a path, a fragment or a word, nor with a leading zero', () => {
    expect(githubIn('&#123; docs/a.md#12 a#1 #012 ##3', ['acme/game'])).toEqual([]);
  });

  it('reads a color written as digits and “the #1 cause” as GitHub does: as candidates', () => {
    expect(githubIn('#112233 is the #1 cause', ['acme/game']).map(({ key }) => key)).toEqual(['acme/game#112233', 'acme/game#1']);
  });

  it('opens an issue at its issues page, which GitHub sends on to a pull request', () => {
    expect(githubGrammar.issueUrl('https://github.com', 'acme/game#12')).toBe('https://github.com/acme/game/issues/12');
    expect(githubKeyParts('acme/game#12')).toEqual({ owner: 'acme', name: 'game', number: 12 });
  });

  it('opens the classic token page with the repo scope', () => {
    expect(githubGrammar.tokenPageUrl('https://github.com')).toBe('https://github.com/settings/tokens/new?scopes=repo&description=UVCS%20Desktop');
  });

  it('tells its tokens by their prefixes', () => {
    expect(githubGrammar.tokenShape(`ghp_${'a'.repeat(36)}`)).toBe('known');
    expect(githubGrammar.tokenShape(`github_pat_${'A1_'.repeat(28)}`)).toBe('known');
    expect(githubGrammar.tokenShape('ghp_short')).toBe('none');
  });

  it('finds the API of github.com, a data residency host and an Enterprise Server', () => {
    expect(githubApiBase('https://github.com')).toBe('https://api.github.com');
    expect(githubGraphqlUrl('https://github.com')).toBe('https://api.github.com/graphql');
    expect(githubApiBase('https://octo.ghe.com')).toBe('https://api.octo.ghe.com');
    expect(githubApiBase('https://git.acme.com')).toBe('https://git.acme.com/api/v3');
    expect(githubGraphqlUrl('https://git.acme.com')).toBe('https://git.acme.com/api/graphql');
  });
});
