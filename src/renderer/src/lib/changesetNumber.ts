const CHANGESET_NUMBER = /^(?:cs:)?(\d+)$/i;

/** The changeset a user typed, as its number (`1234`) or its spec (`cs:1234`); undefined for anything else. */
export function typedChangesetNumber(text: string): number | undefined {
  const digits = CHANGESET_NUMBER.exec(text.trim())?.[1];
  return digits === undefined ? undefined : Number(digits);
}
