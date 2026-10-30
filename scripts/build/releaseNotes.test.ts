import { describe, expect, it } from 'vitest';
import { releaseNotesMarkdown, type MergedPullRequest } from './releaseNotes';

const CHANGELOG = 'https://github.com/Unity-Technologies/uvcs-desktop-client/compare/v0.2.4...v0.2.5';

function pullRequest(number: number, title: string, note: string, author = 'danipen'): MergedPullRequest {
  return {
    number,
    title,
    url: `https://github.com/Unity-Technologies/uvcs-desktop-client/pull/${number}`,
    body: `## What does this pull request do?\n\nSomething.\n\n## Release note\n\n${note}\n\n## Current behavior\n\nNone.`,
    author: { login: author },
  };
}

describe("a release's notes", () => {
  it('group the pull requests\' notes as New, Improved and Fixed, in the order they merged', () => {
    const notes = releaseNotesMarkdown(
      [
        pullRequest(170, 'Fix the window close', '### Fixed: Closing a window no longer stops what it\'s doing\n\nThe app waits for it to finish.'),
        pullRequest(171, 'Tools', '### New: Run your own tools\n\nIn **Settings › Tools**.\n\n![Tools](https://github.com/user-attachments/assets/1)'),
        pullRequest(172, 'Details toggle', '### Improved: Hide the details panel the same way in every view\n\nUse ⌘I or Ctrl+I.'),
        pullRequest(173, 'Shelves', '### New: Edit a shelve\'s comment\n\nFrom its menu.'),
      ],
      CHANGELOG,
    );

    expect(notes).toBe(
      [
        '## New',
        '### Run your own tools',
        'In **Settings › Tools**.\n\n![Tools](https://github.com/user-attachments/assets/1)',
        "### Edit a shelve's comment",
        'From its menu.',
        '## Improved',
        '### Hide the details panel the same way in every view',
        'Use ⌘I or Ctrl+I.',
        '## Fixed',
        "### Closing a window no longer stops what it's doing",
        'The app waits for it to finish.',
        `**Full Changelog**: ${CHANGELOG}`,
      ].join('\n\n') + '\n',
    );
  });

  it('leave out the pull requests with nothing for users, and Dependabot\'s', () => {
    const notes = releaseNotesMarkdown(
      [
        pullRequest(170, 'Refactor', 'None: moves code between services.'),
        pullRequest(171, 'Bump undici', '', 'dependabot[bot]'),
        pullRequest(172, 'Shelves', '### Fixed: Shelves open\n\nThey open again.'),
      ],
      CHANGELOG,
    );

    expect(notes).toBe(['## Fixed', '### Shelves open', 'They open again.', `**Full Changelog**: ${CHANGELOG}`].join('\n\n') + '\n');
  });

  it("list by title the pull requests merged before notes were asked for, or whose note can't be read", () => {
    const withoutSection = { ...pullRequest(162, '', ''), title: 'The palette finds branches by their description', body: 'Old body.' };
    const notes = releaseNotesMarkdown([withoutSection, pullRequest(163, 'Tools', '### Feature: Tools\n\nIn Settings.')], null);

    expect(notes).toBe('## Other changes\n\n- The palette finds branches by their description (#162)\n- Tools (#163)\n');
  });

  it('say so when nothing changed for users', () => {
    expect(releaseNotesMarkdown([pullRequest(170, 'Refactor', 'None: tooling.')], CHANGELOG)).toBe(
      `No changes for users in this version.\n\n**Full Changelog**: ${CHANGELOG}\n`,
    );
  });
});
