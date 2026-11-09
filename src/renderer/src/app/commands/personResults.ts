import { User } from 'lucide-react';
import { showPersonChangesets } from '../../features/changesets/showPersonChangesets';
import { EVERYONE, offeredPeople } from '../../lib/peopleFilter';
import { displayName } from '../../lib/userName';
import type { SearchResult } from './searchResults';

/**
 * Who the palette offers after `@`, with no query of its own (no `cm` command lists people): the owners of the lists
 * it already reads (`owners`) and everyone the place's views showed this session (`seen`, `peopleSeenIn`), as the
 * views' people picker offers them, so each is someone `cm find` knows as an owner. The user first, when known, then
 * everyone by the name shown (`offeredPeople`).
 */
export function palettePeople(owners: Iterable<string>, seen: readonly string[], me: string | undefined): string[] {
  const people = new Set([...owners, ...seen]);
  return [...(me ? [me] : []), ...offeredPeople(people, EVERYONE, me)];
}

/** A person: their name, how `cm` names them, and, picked, the Changesets view on their changesets. */
export function personResult(person: string, me: string | undefined): SearchResult {
  return {
    id: `person:${person}`,
    icon: User,
    label: displayName(person) || person,
    detail: person === me ? `${person} · you` : person,
    run: () => showPersonChangesets(person, me),
  };
}
