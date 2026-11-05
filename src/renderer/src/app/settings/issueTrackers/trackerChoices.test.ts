import { describe, expect, it } from 'vitest';
import { choiceAfterLink, choiceOf, connectWords, switchedWords, trackerChoiceCard, TRACKER_CHOICES } from './trackerChoices';

describe('the tracker choices', () => {
  it('offers Jira and GitHub, each with only its own link shapes', () => {
    expect(TRACKER_CHOICES.map((card) => [card.name, card.servers])).toEqual([
      ['Jira', 'Cloud or Data Center'],
      ['GitHub', 'github.com or Enterprise'],
    ]);
    expect(trackerChoiceCard('jira').examples.map((example) => example.label)).toEqual(['Cloud', 'Data Center']);
    expect(trackerChoiceCard('github').examples.every((example) => example.shape.includes('/issues/'))).toBe(true);
  });

  it('counts Jira Cloud and Data Center as Jira', () => {
    expect([choiceOf('jiraCloud'), choiceOf('jiraDataCenter'), choiceOf('github')]).toEqual(['jira', 'jira', 'github']);
  });
});

describe('choiceAfterLink', () => {
  it('stays on the tracker chosen for its own links, Cloud or Data Center', () => {
    expect(choiceAfterLink('jira', 'https://acme.atlassian.net/browse/VCS-1')).toEqual({ choice: 'jira', switched: false });
    expect(choiceAfterLink('jira', 'https://jira.unity3d.com/browse/VCS-1009081')).toEqual({ choice: 'jira', switched: false });
  });

  it('moves to the tracker another tracker’s link names, never refusing it', () => {
    expect(choiceAfterLink('jira', 'https://github.com/acme/game/issues/12')).toEqual({ choice: 'github', switched: true });
    expect(choiceAfterLink('github', 'https://acme.atlassian.net/browse/VCS-1')).toEqual({ choice: 'jira', switched: true });
    expect(switchedWords('github')).toBe("That's a GitHub link, so this connects GitHub.");
  });

  it('stays put while the text isn’t a link to an issue', () => {
    expect(choiceAfterLink('github', '')).toEqual({ choice: 'github', switched: false });
    expect(choiceAfterLink('github', 'https://example.com/x')).toEqual({ choice: 'github', switched: false });
  });
});

describe('connectWords', () => {
  it('connects a repository’s tracker, or signs in alone where the window has no repository', () => {
    expect(connectWords(trackerChoiceCard('jira'), true).title).toBe('Connect Jira');
    expect(connectWords(trackerChoiceCard('github'), false).title).toBe('Sign in to GitHub');
  });
});
