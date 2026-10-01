import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUG_REPORT_FORM,
  bugReportUrl,
  CUT_SHORT_MARK,
  FEATURE_REQUEST_FORM,
  issueFormUrl,
  MAX_ISSUE_TITLE_LENGTH,
  MAX_ISSUE_URL_LENGTH,
} from './issueForms';

const ISSUES_URL = 'https://github.com/Unity-Technologies/uvcs-desktop-client/issues/new';
const TEMPLATES = join(__dirname, '..', '..', '.github', 'ISSUE_TEMPLATE');

/** The ids of a form's fields: the query parameters GitHub prefills them from. */
function fieldIdsOf(template: string): string[] {
  const form = readFileSync(join(TEMPLATES, template), 'utf8');
  return [...form.matchAll(/^\s+id:\s*(\S+)\s*$/gm)].map((match) => match[1]!);
}

/** The prefilled values, as GitHub reads them from the address. */
function paramsOf(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams);
}

describe('the issue forms', () => {
  it('have the fields the app fills in', () => {
    expect(fieldIdsOf(BUG_REPORT_FORM.template)).toEqual(expect.arrayContaining([BUG_REPORT_FORM.appDetails, BUG_REPORT_FORM.errorDetails]));
    expect(fieldIdsOf(FEATURE_REQUEST_FORM.template).length).toBeGreaterThan(0);
  });
});

describe('issueFormUrl', () => {
  it('opens the form alone when there is nothing to fill in', () => {
    expect(issueFormUrl(ISSUES_URL, FEATURE_REQUEST_FORM.template)).toBe(`${ISSUES_URL}?template=feature_request.yml`);
  });

  it('encodes every value, so newlines, ampersands and Unicode arrive as written', () => {
    const url = issueFormUrl(ISSUES_URL, BUG_REPORT_FORM.template, {
      title: 'Merge failed: a & b',
      fields: [['error-details', 'line 1\r\nline 2 = ünïcødé 🙂 #3 +x']],
    });

    expect(url).not.toMatch(/[\s#]/);
    expect(paramsOf(url)).toEqual({ template: 'bug_report.yml', title: 'Merge failed: a & b', 'error-details': 'line 1\r\nline 2 = ünïcødé 🙂 #3 +x' });
  });

  it('titles the issue with the first line, cut to one line of an issue list', () => {
    expect(paramsOf(issueFormUrl(ISSUES_URL, 't.yml', { title: '  Checkin failed\nThe item is locked' })).title).toBe('Checkin failed');
    const long = paramsOf(issueFormUrl(ISSUES_URL, 't.yml', { title: 'é'.repeat(500) })).title!;
    expect(Array.from(long)).toHaveLength(MAX_ISSUE_TITLE_LENGTH);
    expect(long.endsWith('…')).toBe(true);
  });

  it('cuts a long field short to keep the address well under what GitHub takes, and says so', () => {
    const output = Array.from({ length: 5000 }, (_, line) => `error line ${line}: ✗ ünïcødé`).join('\n');
    const url = issueFormUrl(ISSUES_URL, 't.yml', { fields: [['app-details', 'cm: 11.0'], ['error-details', output]] });

    expect(url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
    const params = paramsOf(url);
    expect(params['app-details']).toBe('cm: 11.0');
    expect(params['error-details']!.endsWith(CUT_SHORT_MARK)).toBe(true);
    expect(output.startsWith(params['error-details']!.slice(0, -CUT_SHORT_MARK.length))).toBe(true);
  });

  it('leaves out the fields after one with no room left', () => {
    const url = issueFormUrl(ISSUES_URL, 't.yml', { fields: [['first', 'x'.repeat(10_000)], ['second', 'y']] });

    expect(url.length).toBeLessThanOrEqual(MAX_ISSUE_URL_LENGTH);
    expect(Object.keys(paramsOf(url))).toEqual(['template', 'first']);
  });

  it("never fails on half an emoji, which a cut in cm's output can leave", () => {
    const url = issueFormUrl(ISSUES_URL, 't.yml', { fields: [['error-details', 'broken \uD83D here']] });

    expect(paramsOf(url)['error-details']).toBe('broken \uFFFD here');
  });
});

describe('bugReportUrl', () => {
  it('fills in the app details and the error, and nothing else', () => {
    const url = bugReportUrl(ISSUES_URL, { title: 'Sync failed', appDetails: 'cm: 11.0', errorDetails: 'cm sync --pwd=•••' });

    expect(paramsOf(url)).toEqual({ template: 'bug_report.yml', title: 'Sync failed', 'app-details': 'cm: 11.0', 'error-details': 'cm sync --pwd=•••' });
  });
});
