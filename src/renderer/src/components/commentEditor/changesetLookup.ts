import { useEffect, useState } from 'react';

/** How long typing pauses before a changeset's number is looked up: the palette's server search waits as long. */
export const LOOKUP_DELAY_MS = 300;

/** The changeset number typed that the newest changesets don't hold, to look up; null for none (words, or listed). */
export function changesetToLookUp(typed: string, listed: readonly { label: string }[]): number | null {
  return /^\d+$/.test(typed) && !listed.some((suggestion) => suggestion.label === typed) ? Number(typed) : null;
}

/**
 * Hands on the number to look up once typing stops for `LOOKUP_DELAY_MS`, never at the first digit: `cs:4207` typed a
 * key at a time reads changeset 4207 alone, not 4, 42 and 420 on the way.
 */
export function createLookupSchedule(settled: (id: number | null) => void): { typed: (id: number | null) => void; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    typed: (id) => {
      clearTimeout(timer);
      timer = setTimeout(() => settled(id), LOOKUP_DELAY_MS);
    },
    stop: () => clearTimeout(timer),
  };
}

/** The number to look up, once typing stopped on it (`createLookupSchedule`). */
export function useSettledLookup(id: number | null): number | null {
  const [settled, setSettled] = useState<number | null>(null);
  const [schedule] = useState(() => createLookupSchedule(setSettled));
  useEffect(() => schedule.typed(id), [schedule, id]);
  useEffect(() => () => schedule.stop(), [schedule]);
  return settled;
}
