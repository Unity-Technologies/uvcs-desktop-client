const CHANGESET_NUMBER = /^(?:cs:)?(\d+)$/i;

/** The changeset a user typed, as its number (`1234`) or its spec (`cs:1234`); undefined for anything else. */
export function typedChangesetNumber(text: string): number | undefined {
  const digits = CHANGESET_NUMBER.exec(text.trim())?.[1];
  // Past a safe integer, `Number` rounds it or writes it as `1e+24`: no changeset has such a number.
  return digits === undefined || !Number.isSafeInteger(Number(digits)) ? undefined : Number(digits);
}
