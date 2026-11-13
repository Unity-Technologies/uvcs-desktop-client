/**
 * Whether a `cm` (its version as `cm version` prints it, `11.0.16.10512`) is `first` or later: for what only newer
 * `cm`s do. A version it can't read answers no, so what an older `cm` would get wrong is offered only where it can't.
 */
export function cmVersionAtLeast(cmVersion: string | undefined, first: readonly number[]): boolean {
  const parts = cmVersion?.trim().split('.') ?? [];
  if (parts.length !== first.length || !parts.every((part) => /^\d+$/.test(part))) return false;
  for (const [index, wanted] of first.entries()) {
    const part = Number(parts[index]);
    if (part !== wanted) return part > wanted;
  }
  return true;
}
