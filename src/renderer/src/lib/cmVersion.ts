/** A `cm` version as `cm version` prints it, in its four numbers (`11.0.16.10512`). */
export type CmVersionNumbers = readonly [number, number, number, number];

/**
 * Whether this `cm` (its version as `cm version` prints it) is `first` or later: what offers a command only from the
 * version that has it (`editsBranchComments`, `readsReviewSubscriptions`). A version it can't read answers no, so a
 * command an older `cm` would take for something else is never sent where it can't be told apart.
 */
export function isCmVersionAtLeast(cmVersion: string | undefined, first: CmVersionNumbers): boolean {
  const parts = cmVersion?.trim().split('.') ?? [];
  if (parts.length !== first.length || !parts.every((part) => /^\d+$/.test(part))) return false;
  for (const [index, number] of first.entries()) {
    const part = Number(parts[index]);
    if (part !== number) return part > number;
  }
  return true;
}
