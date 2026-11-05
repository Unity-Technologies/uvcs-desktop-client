import { describe, expect, it } from 'vitest';
import { recognizeTrackerLink } from './trackerGrammars';

describe('recognizeTrackerLink', () => {
  it('reads a Jira Cloud issue page: its site, project and key', () => {
    expect(recognizeTrackerLink('https://unity3d.atlassian.net/browse/VCS-1009139')).toEqual({
      kind: 'jiraCloud',
      server: 'https://unity3d.atlassian.net',
      project: 'VCS',
      key: 'VCS-1009139',
      shows: 'issuePage',
    });
  });

  it('reads an older jira.com site, and a link pasted without its scheme', () => {
    expect(recognizeTrackerLink('acme.jira.com/browse/OPS-12')).toMatchObject({ kind: 'jiraCloud', server: 'https://acme.jira.com', key: 'OPS-12' });
  });

  it('reads the issue a Jira board shows as one in a view, a sample but not its page', () => {
    expect(recognizeTrackerLink('https://acme.atlassian.net/jira/software/projects/VCS/boards/7?selectedIssue=VCS-12')).toMatchObject({ key: 'VCS-12', shows: 'issueInView' });
  });

  it('says what a Jira page that names no issue is', () => {
    expect(recognizeTrackerLink('https://acme.atlassian.net/jira/software/projects/VCS/boards/7')).toEqual({ kind: 'jiraCloud', notAnIssue: 'a Jira board' });
    expect(recognizeTrackerLink('https://acme.atlassian.net/jira/software/projects/VCS')).toEqual({ kind: 'jiraCloud', notAnIssue: 'a Jira project' });
  });

  it('reads a GitHub issue and pull request, owner and repository in lower case', () => {
    expect(recognizeTrackerLink('https://github.com/Acme/Game/issues/12')).toEqual({
      kind: 'github',
      server: 'https://github.com',
      project: 'acme/game',
      key: 'acme/game#12',
      shows: 'issuePage',
    });
    expect(recognizeTrackerLink('https://github.com/acme/game/pull/7')).toMatchObject({ key: 'acme/game#7' });
  });

  it('reads GitHub with data residency as GitHub', () => {
    expect(recognizeTrackerLink('https://octo.ghe.com/acme/game/issues/3')).toMatchObject({ kind: 'github', server: 'https://octo.ghe.com', key: 'acme/game#3' });
  });

  it('reads any other host’s issue page as GitHub Enterprise Server, an older GitLab’s too, keeping its scheme', () => {
    expect(recognizeTrackerLink('https://git.acme.com/tools/build/issues/9')).toMatchObject({ kind: 'github', server: 'https://git.acme.com' });
    expect(recognizeTrackerLink('http://git.acme.com/tools/build/issues/9')).toMatchObject({ kind: 'github', server: 'http://git.acme.com' });
  });

  it('says what a GitHub page that names no issue is', () => {
    expect(recognizeTrackerLink('https://github.com/acme/game')).toEqual({ kind: 'github', notAnIssue: 'a GitHub repository' });
    expect(recognizeTrackerLink('https://github.com/settings/profile')).toEqual({ kind: 'github', notAnIssue: 'a GitHub repository' });
  });

  it('knows no tracker in a GitLab issue, nor in other pages of other hosts', () => {
    expect(recognizeTrackerLink('https://gitlab.com/group/project/-/issues/4')).toEqual({ unknownTracker: true });
    expect(recognizeTrackerLink('https://example.com/about')).toEqual({ unknownTracker: true });
  });

  it('reads no link in words', () => {
    expect(recognizeTrackerLink('')).toEqual({ notALink: true });
    expect(recognizeTrackerLink('VCS-12 is broken')).toEqual({ notALink: true });
  });
});
