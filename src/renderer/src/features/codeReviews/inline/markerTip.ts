import { commentText } from '../../../lib/comments/commentText';
import { displayName } from '../../../lib/userName';
import { repliesText, threadBadges, threadKindName } from '../conversation/threadBadges';
import type { MarkedThreads } from './threadRows';

/** A marker previews this many threads of its line, then counts the rest. */
const PREVIEWED_THREADS = 3;

/** About this many characters of a thread's first comment preview it. */
const PREVIEW_CHARACTERS = 80;

/** A cut goes back to the word it's in, unless that leaves fewer characters than this. */
const SHORTEST_WORD_CUT = 60;

/**
 * What a hidden comment's marker says on hover, as plain text: each thread of its line (or the outdated ones), its
 * first words and then its kind, where it stands, who started it and its replies ("Why not a while loop?" / "Question · Open · Borja · 1
 * reply"); a blank line between threads, three at most and how many more. Not the line (the marker is on it), nor
 * only who wrote there (its avatars show that).
 */
export function markerTip(line: MarkedThreads): string {
  const previews = line.threads.slice(0, PREVIEWED_THREADS).map(({ thread }) => {
    const words = cutAtWord(commentText(thread.root.text).replace(/\s+/g, ' ').trim());
    const about = [threadKindName(thread.root), threadBadges(thread).state?.label, displayName(thread.root.author), repliesText(thread)];
    return `${words}\n${about.filter(Boolean).join(' · ')}`;
  });
  const more = line.threads.length - PREVIEWED_THREADS;
  return [...previews, ...(more > 0 ? [`+${more} more`] : [])].join('\n\n');
}

/** `text` cut to about `PREVIEW_CHARACTERS`, between code points, at a word where one ends late enough, with an ellipsis. */
function cutAtWord(text: string): string {
  const characters = [...text];
  if (characters.length <= PREVIEW_CHARACTERS) return text;
  const cut = characters.slice(0, PREVIEW_CHARACTERS).join('');
  const space = cut.lastIndexOf(' ');
  const atWord = space >= SHORTEST_WORD_CUT ? cut.slice(0, space) : cut;
  return `${atWord.trimEnd()}…`;
}
