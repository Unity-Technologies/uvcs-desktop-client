import { useEffect, useState } from 'react';
import type { SelectionState } from '../../lib/selection';
import { selectCreated } from './selectCreated';

/**
 * Selects a row just created once the refreshed list shows it (`selectCreated`). Returns what to call with the new
 * row's key when it is created.
 */
export function useSelectCreated(shownKeys: readonly string[], select: (selection: SelectionState) => void): (createdKey: string) => void {
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  // The keys joined: a new array of the same rows on every render changes nothing.
  const shown = shownKeys.join('\n');
  useEffect(() => {
    const next = selectCreated(shown.split('\n'), createdKey);
    if (!next) return;
    select(next);
    setCreatedKey(null);
  }, [shown, createdKey, select]);
  return setCreatedKey;
}
