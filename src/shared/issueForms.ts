/**
 * The repository's issue forms (`.github/ISSUE_TEMPLATE/`) and the ids of the fields the app fills in: GitHub prefills
 * a form's field from the query parameter named after its `id`. `issueForms.test.ts` checks them against the forms.
 */
export const BUG_REPORT_FORM = { template: 'bug_report.yml', appDetails: 'app-details', errorDetails: 'error-details' } as const;
export const FEATURE_REQUEST_FORM = { template: 'feature_request.yml' } as const;

/** GitHub rejects addresses much over 8 KB; a prefilled form stays well under, whatever the error says. */
export const MAX_ISSUE_URL_LENGTH = 6000;
/** A title is one line of an issue list: anything longer is cut, and the full text goes in the body. */
export const MAX_ISSUE_TITLE_LENGTH = 120;
/** Ends a field cut short to fit the address, so the reader (a person or an agent) knows the text goes on. */
export const CUT_SHORT_MARK = '\n[… cut short to fit the link]';

export interface IssuePrefill {
  title?: string;
  /** Field id and value, in the order they fill the address: a field that doesn't fit whole is cut, and the rest left out. */
  fields?: ReadonlyArray<readonly [id: string, value: string]>;
}

/**
 * The address of a new issue on `template`, prefilled. The user reviews and sends it in the browser: nothing is sent
 * by opening it. `issuesUrl` is the repository's `issues/new` (`AppInfo.issuesUrl`).
 */
export function issueFormUrl(issuesUrl: string, template: string, { title, fields = [] }: IssuePrefill = {}): string {
  let url = `${issuesUrl}?template=${encodeURIComponent(template)}`;
  if (title) url += `&title=${encode(shortTitle(title))}`;
  for (const [id, value] of fields) {
    const key = `&${encodeURIComponent(id)}=`;
    const room = MAX_ISSUE_URL_LENGTH - url.length - key.length;
    const encoded = encodedToFit(value, room);
    if (encoded === undefined) break;
    url += key + encoded;
  }
  return url;
}

/** A bug report on the error the user saw: its title, the app's details and the error's own details. */
export function bugReportUrl(issuesUrl: string, report: { title: string; appDetails: string; errorDetails: string }): string {
  return issueFormUrl(issuesUrl, BUG_REPORT_FORM.template, {
    title: report.title,
    fields: [
      [BUG_REPORT_FORM.appDetails, report.appDetails],
      [BUG_REPORT_FORM.errorDetails, report.errorDetails],
    ],
  });
}

/** The first line, at most `MAX_ISSUE_TITLE_LENGTH` characters. */
function shortTitle(title: string): string {
  const firstLine = title.trim().split(/\r?\n/, 1)[0]!;
  const characters = Array.from(firstLine);
  return characters.length <= MAX_ISSUE_TITLE_LENGTH ? firstLine : `${characters.slice(0, MAX_ISSUE_TITLE_LENGTH - 1).join('')}…`;
}

/** `value` encoded in at most `room` characters, cut short (and marked) when it doesn't fit; undefined when nothing does. */
function encodedToFit(value: string, room: number): string | undefined {
  const whole = encode(value);
  if (whole.length <= room) return whole;
  const mark = encode(CUT_SHORT_MARK);
  if (room < mark.length) return undefined;
  let kept = '';
  // Whole characters only, so a cut never splits a character's %XX bytes.
  for (const character of value) {
    const next = encode(character);
    if (kept.length + next.length + mark.length > room) break;
    kept += next;
  }
  return kept + mark;
}

/**
 * `encodeURIComponent`, which throws on a lone surrogate (half of an emoji left by a cut in `cm`'s output): those
 * become U+FFFD first.
 */
function encode(text: string): string {
  return encodeURIComponent(text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD'));
}
