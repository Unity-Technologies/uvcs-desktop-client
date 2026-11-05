import type { IssueTrackerKind } from '@shared/domain/issueTrackers';
import { isRecognizedLink, recognizeTrackerLink } from '@shared/issueTrackers/trackerGrammars';

/**
 * The trackers Connect starts from (docs/features/issue-trackers.md, "Connecting"): a family each, whatever server its
 * link turns out to be. Jira is one choice: its link tells Cloud from Data Center, so nobody has to know which they run.
 */
export type TrackerChoice = 'jira' | 'github';

/** A tracker's card in the picker, and its link step: what to paste, with only its own link shapes. */
export interface TrackerChoiceCard {
  choice: TrackerChoice;
  name: string;
  /** The servers it covers, under its name. */
  servers: string;
  /** The link field's label. */
  linkLabel: string;
  placeholder: string;
  /** Its link shapes, each with the server it's for. */
  examples: readonly { label: string; shape: string }[];
}

export const TRACKER_CHOICES: readonly TrackerChoiceCard[] = [
  {
    choice: 'jira',
    name: 'Jira',
    servers: 'Cloud or Data Center',
    linkLabel: 'Link to any Jira issue',
    placeholder: 'https://your-company.atlassian.net/browse/PROJ-123',
    examples: [
      { label: 'Cloud', shape: 'your-company.atlassian.net/browse/PROJ-123' },
      { label: 'Data Center', shape: 'jira.your-company.com/browse/PROJ-123' },
    ],
  },
  {
    choice: 'github',
    name: 'GitHub',
    servers: 'github.com or Enterprise',
    linkLabel: 'Link to any GitHub issue',
    placeholder: 'https://github.com/owner/repo/issues/123',
    examples: [
      { label: 'github.com', shape: 'github.com/owner/repo/issues/123' },
      { label: 'Enterprise', shape: 'github.your-company.com/owner/repo/issues/123' },
    ],
  },
];

export function trackerChoiceCard(choice: TrackerChoice): TrackerChoiceCard {
  return TRACKER_CHOICES.find((card) => card.choice === choice) ?? TRACKER_CHOICES[0]!;
}

/** The family a tracker's kind belongs to: Jira Cloud and Data Center are both Jira. */
export function choiceOf(kind: IssueTrackerKind): TrackerChoice {
  return kind === 'github' ? 'github' : 'jira';
}

/**
 * The tracker a link step stands on once `text` is in its field: a link to another tracker's issue (a GitHub link on
 * Jira's step) is taken, never refused, and the step moves to that tracker, saying so (`switchedWords`).
 */
export function choiceAfterLink(choice: TrackerChoice, text: string): { choice: TrackerChoice; switched: boolean } {
  const reading = recognizeTrackerLink(text);
  if (!text.trim() || !isRecognizedLink(reading)) return { choice, switched: false };
  const linked = choiceOf(reading.kind);
  return { choice: linked, switched: linked !== choice };
}

/** What the link step says after moving to the tracker a link named. */
export function switchedWords(choice: TrackerChoice): string {
  return `That's a ${trackerChoiceCard(choice).name} link, so this connects ${trackerChoiceCard(choice).name}.`;
}

/** Where an arrow key moves the focus among the picker's cards: around the row, either way, wrapping. */
export function choiceKeyMove(index: number, key: string, count: number): number | null {
  if (count === 0) return null;
  if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/**
 * Connect's title and lead, for a repository (its tracker) or a window with none (a sign-in alone, which any
 * repository then connects to in one click).
 */
export function connectWords(card: TrackerChoiceCard | null, forRepository: boolean): { title: string; intro: string } {
  if (forRepository) {
    return { title: card ? `Connect ${card.name}` : 'Connect an issue tracker', intro: "Issue keys and links in this repository's comments show each issue's title and status." };
  }
  return { title: card ? `Sign in to ${card.name}` : 'Sign in to an issue tracker', intro: 'Sign in once, and any repository connects to it in one click.' };
}

/** The first step's two groups, where the computer already keeps sign-ins: those first, then the trackers. */
export const PICKER_WORDS = { signIns: 'Use a sign-in you already have', others: 'Or sign in to another tracker' };
