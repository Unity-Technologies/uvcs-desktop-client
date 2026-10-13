import { CmError } from './CmError';

/**
 * `cm` telling an item isn't there: `The specified item /a.cs does not exist.`, or `cm ls --tree`'s `Can't resolve the
 * selector for the item /a.cs` (a failure: exit code 1, with an empty listing).
 */
export function isMissingItemError(error: unknown): boolean {
  return error instanceof CmError && /does not exist|can't resolve the selector for the item/i.test(error.message);
}

/**
 * `cm cat serverpath:/a.cs#cs:3` finding nothing: `The specified revision was not found serverpath:/a.cs#cs:3`. It
 * doesn't tell a missing file from one under an xlink (or a point that isn't there), so it means the file is absent
 * only where nothing else could find it (a shelve's path, whose tree can't be listed).
 */
export function isServerPathNotFoundError(error: unknown): boolean {
  return error instanceof CmError && /the specified revision was not found serverpath:/i.test(error.message);
}
