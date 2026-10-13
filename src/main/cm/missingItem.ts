import { CmError } from './CmError';

/**
 * `cm` telling an item isn't there: `The specified item /a.cs does not exist.`, or `cm ls --tree`'s `Can't resolve the
 * selector for the item /a.cs` (a failure: exit code 1, with an empty listing).
 */
export function isMissingItemError(error: unknown): boolean {
  return error instanceof CmError && /does not exist|can't resolve the selector for the item/i.test(error.message);
}
