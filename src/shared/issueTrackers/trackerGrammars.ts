import type { IssueTrackerKind } from '../domain/issueTrackers';
import { githubGrammar } from './grammars/github';
import { jiraCloudGrammar } from './grammars/jiraCloud';
import type { NotAnIssueLink, RecognizedLink, TrackerGrammar } from './trackerGrammar';

/** Every tracker's grammar, by kind: a new kind doesn't compile until it has one. */
export const TRACKER_GRAMMARS: Readonly<Record<IssueTrackerKind, TrackerGrammar>> = {
  jiraCloud: jiraCloudGrammar,
  github: githubGrammar,
};

/**
 * The order links are read in (docs/features/issue-trackers.md, "Ambiguous links"): by their host first where it says
 * the tracker (`*.atlassian.net`), GitHub's last, as any other host's `/owner/repo/issues/12` is read as an Enterprise
 * Server's.
 */
const RECOGNIZING_ORDER: readonly TrackerGrammar[] = [jiraCloudGrammar, githubGrammar];

export type LinkReading = RecognizedLink | NotAnIssueLink | { notALink: true } | { unknownTracker: true };

/** A pasted link read back: a tracker's issue, a tracker's page that isn't one, or neither. */
export function recognizeTrackerLink(text: string): LinkReading {
  const url = parseUrl(text.trim());
  if (!url) return { notALink: true };
  for (const grammar of RECOGNIZING_ORDER) {
    const reading = grammar.recognize(url);
    if (reading) return reading;
  }
  return { unknownTracker: true };
}

export function isRecognizedLink(reading: LinkReading): reading is RecognizedLink {
  return 'key' in reading;
}

/** An address as a link holds it, scheme included; a bare host (`acme.atlassian.net/browse/VCS-1`) reads as https. */
function parseUrl(text: string): URL | null {
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') || url.hostname === 'localhost' ? url : null;
  } catch {
    return null;
  }
}
