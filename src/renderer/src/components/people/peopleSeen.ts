/**
 * Everyone each list has shown in this session, by workspace and list: the people a list read by people on the server
 * can offer (`usePeopleSeen`). Filtered on the server, it reads only the people picked, so the others it showed before
 * stay offered, with no query to list people.
 */
export interface PeopleSeen {
  /** Adds the owners a list shows now, and returns everyone it has shown in the workspace, in the order first seen. */
  /** `place` is the place's id (`placeId`): each place sees its own people. */
  remember: (place: string, list: string, owners: Iterable<string>) => string[];
  /** Everyone any list of the place has shown, in the order first seen: who a comment can mention (`@`). */
  everyone: (place: string) => string[];
}

export function createPeopleSeen(): PeopleSeen {
  const seenByList = new Map<string, Set<string>>();
  return {
    remember: (place, list, owners) => {
      const key = `${place}\n${list}`;
      const seen = seenByList.get(key) ?? new Set<string>();
      seenByList.set(key, seen);
      for (const owner of owners) seen.add(owner);
      return [...seen];
    },
    everyone: (place) => {
      const people = new Set<string>();
      for (const [key, seen] of seenByList) if (key.startsWith(`${place}\n`)) for (const person of seen) people.add(person);
      return [...people];
    },
  };
}
