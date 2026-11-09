/** The changeset number typed that the newest changesets don't hold, to look up; null for none (words, or listed). */
export function changesetToLookUp(typed: string, listed: readonly { label: string }[]): number | null {
  return /^\d+$/.test(typed) && !listed.some((suggestion) => suggestion.label === typed) ? Number(typed) : null;
}
