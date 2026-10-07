import { useEffect, useRef } from 'react';
import { rowKeyShowing } from '../lib/pathTree';

/**
 * Opens the groups and folders holding the selection whenever it changes, so a file selected from outside the list (a
 * diff opened on it, a merge or an update starting on the first conflict, a resolve run moving on) has its row shown.
 * Only a change of selection opens anything: a folder the user closes around the selection stays closed.
 * `laidOut` are the rows as if nothing were closed; `holding` names the rows holding one (`rowsHolding`).
 */
export function useOpenToSelected<T, Row extends { key: string; item?: T }>(
  laidOut: readonly Row[],
  keyOf: (item: T) => string,
  holding: (rows: readonly Row[], key: string) => string[],
  selectedKey: string | null | undefined,
  openFolders: (keys: readonly string[]) => void,
): void {
  const latest = useRef({ laidOut, keyOf, holding, openFolders });
  latest.current = { laidOut, keyOf, holding, openFolders };
  useEffect(() => {
    if (!selectedKey) return;
    const { laidOut: rows, keyOf: key, holding: holders, openFolders: open } = latest.current;
    open(holders(rows, rowKeyShowing(rows, selectedKey, key)));
  }, [selectedKey]);
}
