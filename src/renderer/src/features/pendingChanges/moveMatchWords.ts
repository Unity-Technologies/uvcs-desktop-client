import type { PendingChange } from '@shared/domain/pendingChanges';
import { fileNameOf } from '../../lib/text';
import type { MatchSide, MoveMatch } from './moveMatches';

/** What the "Search matches" dialog says, for the change it was opened on. */
export interface MatchDialogWords {
  title: string;
  description: string;
  placeholder: string;
  /** With no candidate to pick. */
  empty: string;
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
      empty: privateShown ? `No new ${noun}s in Changes.` : 'Changes hides private files: Settings › Changes shows them.',
    };
  }
  return {
    title: `Where did ${name} come from?`,
    description: `Pick the deleted ${noun} it was. ${afterCheckin}`,
    placeholder: `Find a deleted ${noun}`,
    empty: `No deleted ${noun}s in Changes.`,
  };
}

/** The toast once the move is recorded: "Matched Player.cs with src/game/Hero.cs". */
export function matchedMessage({ from, to }: MoveMatch): string {
  return `Matched ${fileNameOf(from)} with ${to}`;
}
