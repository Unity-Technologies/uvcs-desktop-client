import type { PendingChange } from '@shared/domain/pendingChanges';
import { fileNameOf } from '../../lib/text';
import type { MatchSide, MoveMatch } from './moveMatches';

/** What the "Search matches" dialog says, for the change it was opened on. */
export interface MatchDialogWords {
  title: string;
  description: string;
  placeholder: string;
  /** What the rows are, for screen readers. */
  listLabel: string;
  /** With no candidate to pick. */
  empty: string;
  /** With candidates, none the search finds. */
  noMatches: string;
}

/**
 * Its words: where the deleted item went, or where the new one came from. With no new item to offer while Changes
 * hides private files (`showPrivate`), the empty list says where to show them.
 */
export function matchDialogWords(change: PendingChange, side: MatchSide, privateShown: boolean): MatchDialogWords {
  const noun = change.itemType === 'directory' ? 'folder' : 'file';
  const name = fileNameOf(change.path);
  const afterCheckin = 'Checked in, it becomes a move, and its history goes on.';
  if (side === 'deleted') {
    return {
      title: `Where did ${name} go?`,
      description: `Pick the new ${noun} it became. ${afterCheckin}`,
      placeholder: `Find a new ${noun}`,
      listLabel: `New ${noun}s`,
      noMatches: `No matching new ${noun}s.`,
      empty: privateShown ? `No new ${noun}s in Changes.` : 'Changes hides private files: show them in Settings › Pending changes.',
    };
  }
  return {
    title: `Where did ${name} come from?`,
    description: `Pick the deleted ${noun} it was. ${afterCheckin}`,
    placeholder: `Find a deleted ${noun}`,
    listLabel: `Deleted ${noun}s`,
    noMatches: `No matching deleted ${noun}s.`,
    empty: `No deleted ${noun}s in Changes.`,
  };
}

/** What the list says with no row: nothing to pick, or nothing the search finds. */
export function emptyListWords(words: MatchDialogWords, search: string): string {
  return search.trim() ? words.noMatches : words.empty;
}

/** The toast once the move is recorded: "Matched Player.cs with src/game/Hero.cs". */
export function matchedMessage({ from, to }: MoveMatch): string {
  return `Matched ${fileNameOf(from)} with ${to}`;
}
