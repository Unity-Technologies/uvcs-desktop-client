/**
 * A release's notes: the release notes of the pull requests merged since the last release (`readReleaseNote`),
 * grouped as users read them, in What's New and on the releases page:
 *
 *   ## New
 *
 *   ### <title>
 *
 *   <description>
 *
 *   ## Improved   ## Fixed   (the same)
 *
 *   ## Other changes
 *
 *   - <pull request title> (#162)
 *
 *   **Full Changelog**: <link>
 *
 * Pull requests whose note says "None:" and Dependabot's are left out. "Other changes" lists by title the pull
 * requests without a note that can be read: those merged before notes were asked for. The Release workflow
 * (`.github/workflows/release.yml`) writes this as the draft release's description:
 *
 *   node scripts/build/releaseNotes.ts pull-requests.json [changelog-url] > notes.md
 *
 * where pull-requests.json holds `gh pr view --json number,title,url,body,author` of each, in the order they merged.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readReleaseNote, RELEASE_NOTE_KINDS, type ReleaseNoteKind } from './releaseNote.ts';

export interface MergedPullRequest {
  number: number;
  title: string;
  url: string;
  body: string;
  author: { login: string };
}

interface WrittenNote {
  kind: ReleaseNoteKind;
  title: string;
  description: string;
}

const DEPENDABOT = 'dependabot[bot]';

export function releaseNotesMarkdown(pullRequests: readonly MergedPullRequest[], changelogUrl: string | null): string {
  const notes: WrittenNote[] = [];
  const untold: MergedPullRequest[] = [];
  for (const pullRequest of pullRequests) {
    if (pullRequest.author.login === DEPENDABOT) continue;
    const reading = readReleaseNote(pullRequest.body ?? '');
    if ('problem' in reading) untold.push(pullRequest);
    else if (reading.note.kind !== 'none') notes.push(reading.note);
  }

  const sections = [
    ...RELEASE_NOTE_KINDS.flatMap((kind) => groupOf(kind, notes.filter((note) => note.kind === kind))),
    ...(untold.length > 0 ? ['## Other changes', untold.map(({ title, number }) => `- ${title} (#${number})`).join('\n')] : []),
  ];
  const body = sections.length > 0 ? sections : ['No changes for users in this version.'];
  return [...body, ...(changelogUrl ? [`**Full Changelog**: ${changelogUrl}`] : [])].join('\n\n') + '\n';
}

function groupOf(kind: ReleaseNoteKind, notes: WrittenNote[]): string[] {
  if (notes.length === 0) return [];
  return [`## ${kind}`, ...notes.flatMap(({ title, description }) => [`### ${title}`, description])];
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const [file, changelogUrl] = process.argv.slice(2);
  const pullRequests = JSON.parse(readFileSync(file!, 'utf8')) as MergedPullRequest[];
  process.stdout.write(releaseNotesMarkdown(pullRequests, changelogUrl || null));
}
