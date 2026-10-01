import { describe, expect, it } from 'vitest';
import { MAX_ISSUE_URL_LENGTH } from '@shared/issueForms';
import { errorIssueUrl } from './errorIssueUrl';

const INFO = {
  version: '1.4.0',
  platform: 'win32',
  arch: 'x64',
  electron: '38.1.0',
  chromium: '140.0.7339.80',
  issuesUrl: 'https://github.com/Unity-Technologies/uvcs-desktop-client/issues/new',
};

/** A failed sync as main hands it to the window: `commandLineForLog` and `outputForLog` already hid the password. */
const SYNC_FAILURE = {
  title: 'Sync failed',
  message: 'Authentication failed for https://me:•••@github.com/team/game.git',
  command: {
    commandLine: 'cm sync rep:game@local git https://github.com/team/game.git --user=me --pwd=•••',
    exitCode: 1,
    output: 'Authentication failed for https://me:•••@github.com/team/game.git',
    logEntryId: 7,
  },
};

const paramsOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe('errorIssueUrl', () => {
  it('opens the bug report titled with what failed, with the app details and the error as Copy gives them', () => {
    expect(paramsOf(errorIssueUrl(INFO, '11.0.16.9412', SYNC_FAILURE))).toEqual({
      template: 'bug_report.yml',
      title: 'Sync failed: Authentication failed for https://me:•••@github.com/team/game.git',
      'app-details': ['Unity Version Control: 1.4.0', 'cm: 11.0.16.9412', 'Platform: Windows · x64', 'Electron: 38.1.0', 'Chromium: 140.0.7339.80'].join('\n'),
      'error-details': [
        'Sync failed',
        'Authentication failed for https://me:•••@github.com/team/game.git',
        '',
        '$ cm sync rep:game@local git https://github.com/team/game.git --user=me --pwd=•••',
        'Exit code 1',
        '',
        'Authentication failed for https://me:•••@github.com/team/game.git',
      ].join('\n'),
    });
  });

  it('keeps hidden secrets hidden: nothing but what the dialog shows reaches the address', () => {
    const url = decodeURIComponent(errorIssueUrl(INFO, undefined, SYNC_FAILURE));

    expect(url).not.toMatch(/--pwd=(?!•••)/);
    expect(url).not.toMatch(/:\/\/[^\s/:@]*:(?!•••@)[^\s/@]+@/);
  });

  it('cuts a huge output short instead of making an address GitHub rejects', () => {
    const huge = { ...SYNC_FAILURE, command: { ...SYNC_FAILURE.command, output: 'x '.repeat(50_000) } };

    expect(errorIssueUrl(INFO, '11.0', huge).length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
  });
});
