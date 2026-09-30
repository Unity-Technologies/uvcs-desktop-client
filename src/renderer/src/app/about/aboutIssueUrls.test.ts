import { describe, expect, it } from 'vitest';
import { aboutBugReportUrl, featureRequestUrl } from './aboutIssueUrls';

const INFO = {
  version: '1.4.0',
  platform: 'darwin',
  arch: 'arm64',
  electron: '38.1.0',
  chromium: '140.0.7339.80',
  issuesUrl: 'https://github.com/danipen/uvcs-desktop-client/issues/new',
};

const paramsOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe('aboutBugReportUrl', () => {
  it('opens the bug report with the app details filled in', () => {
    expect(paramsOf(aboutBugReportUrl(INFO, '11.0.16.9412'))).toEqual({
      template: 'bug_report.yml',
      'app-details': ['Unity Version Control: 1.4.0', 'cm: 11.0.16.9412', 'Platform: macOS · arm64', 'Electron: 38.1.0', 'Chromium: 140.0.7339.80'].join('\n'),
    });
  });
});

describe('featureRequestUrl', () => {
  it('opens the feature request form', () => {
    expect(featureRequestUrl(INFO)).toBe('https://github.com/danipen/uvcs-desktop-client/issues/new?template=feature_request.yml');
  });
});
