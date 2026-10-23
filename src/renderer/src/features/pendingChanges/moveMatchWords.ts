import type { PendingChange } from '@shared/domain/pendingChanges';
import { fileNameOf } from '../../lib/text';
import type { MatchCandidate, MatchSide, MoveMatch } from './moveMatches';

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
  /** With candidates, none `cm` would pair: a text file with a binary one, binary files of other extensions. */
  noneOfItsKind: string;
  /** With candidates `cm` would pair, none as alike as the minimum. */
  noneThisAlike: string;
  /** Measuring failed: the rows show unmeasured. */
  notMeasured: string;
}

/** What the list shows, for the words its empty state picks from. */
export interface ListCounts {
  search: string;
  /** Rows the list shows, the search applied. */
  shown: number;
  /** The candidates `cm` would pair; undefined while unknown, or for folders. */
  pairable: number | undefined;
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
      noneOfItsKind: `No new ${noun}s of its kind: a text file pairs with text files, a binary one with its extension.`,
      noneThisAlike: `No new ${noun}s this alike. Lower the minimum to see more.`,
      notMeasured: "Couldn't measure how alike they are.",
      empty: privateShown ? `No new ${noun}s in Changes.` : 'Changes hides private files: show them in Settings › Pending changes.',
    };
  }
  return {
    title: `Where did ${name} come from?`,
    description: `Pick the deleted ${noun} it was. ${afterCheckin}`,
    placeholder: `Find a deleted ${noun}`,
    listLabel: `Deleted ${noun}s`,
    noMatches: `No matching deleted ${noun}s.`,
    noneOfItsKind: `No deleted ${noun}s of its kind: a text file pairs with text files, a binary one with its extension.`,
    noneThisAlike: `No deleted ${noun}s this alike. Lower the minimum to see more.`,
    notMeasured: "Couldn't measure how alike they are.",
    empty: `No deleted ${noun}s in Changes.`,
  };
}

/**
 * What the list says with no row: what the search hides first, then why the slider or `cm`'s pairing hide the rest,
 * then that there was nothing to pick. Null while it shows rows.
 */
export function emptyListWords(words: MatchDialogWords, { search, shown, pairable }: ListCounts, candidates: number): string | null {
  if (shown > 0) return null;
  if (search.trim()) return words.noMatches;
  if (candidates === 0) return words.empty;
  if (pairable === 0) return words.noneOfItsKind;
  return pairable === undefined ? words.empty : words.noneThisAlike;
}

/** The toast once the move is recorded: "Matched Player.cs with src/game/Hero.cs". */
export function matchedMessage({ from, to }: MoveMatch): string {
  return `Matched ${fileNameOf(from)} with ${to}`;
}

/** A candidate's tag when the detection paired it with another item: what with, and what a pick does to that. */
export interface PairingTag {
  label: string;
  tip: string;
}

/** "Paired with Shotgun.cs", its tooltip saying the pick replaces that pairing; null for a candidate nothing paired. */
export function pairingTag(change: PendingChange, candidate: MatchCandidate): PairingTag | null {
  if (candidate.pairedWith === undefined) return null;
  return {
    label: `Paired with ${fileNameOf(candidate.pairedWith)}`,
    tip: `Changes found it moved with ${candidate.pairedWith}. Picking it pairs it with ${fileNameOf(change.path)} instead.`,
  };
}
