import { queryWords } from '../../../lib/matchesAllWords';

/** Whether a name holds every word of a search (`queryWords`, lowercased), in any case. */
export function nameMatcher(words: readonly string[]): (name: string) => boolean {
  return (name) => {
    const haystack = name.toLowerCase();
    return words.every((word) => haystack.includes(word));
  };
}

/**
 * Whether a changeset's comment and owner hold every word between them. Asked of every changeset on every keystroke,
 * so it allocates as little as it can: owners repeat and are matched once, and a comment is lowercased only for a word
 * it doesn't hold as typed (a word found as typed is there lowercased too: the word is lowercase already).
 * A word has no spaces, so it never runs from the comment into the owner: each word is in one or the other.
 */
export function changesetMatcher(words: readonly string[]): (comment: string, owner: string) => boolean {
  const ownerHolds = new Map<string, readonly boolean[]>();
  return (comment, owner) => {
    let inOwner = ownerHolds.get(owner);
    if (!inOwner) {
      const lowerOwner = owner.toLowerCase();
      ownerHolds.set(owner, (inOwner = words.map((word) => lowerOwner.includes(word))));
    }
    let lowerComment: string | null = null;
    for (let index = 0; index < words.length; index++) {
      const word = words[index]!;
      if (inOwner[index] || comment.includes(word)) continue;
      lowerComment ??= comment.toLowerCase();
      if (!lowerComment.includes(word)) return false;
    }
    return true;
  };
}

/**
 * Whether everything matching `query` also matches `previous`, as while typing on: each word of `previous` is part of
 * a word of `query`. Then only what `previous` found needs looking at.
 */
export function narrows(previous: string, query: string): boolean {
  const words = queryWords(query);
  const before = queryWords(previous);
  return before.length > 0 && before.every((old) => words.some((word) => word.includes(old)));
}
