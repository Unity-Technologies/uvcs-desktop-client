import { CmError } from './CmError';

/**
 * `cm` telling an item isn't there: `The item /a.cs does not exist in the workspace.` (or `The specified item /a.cs
 * does not exist.`). Only the item's message: `cm` says "does not exist" of changesets, branches, shelves, objects and
 * users too, which tells nothing of the file.
 */
export function isMissingItemError(error: unknown): boolean {
  return error instanceof CmError && /\bthe (?:specified )?item .+ does not exist\b/i.test(error.message);
}

/**
 * `cm ls <path> --tree=<point>` finding no such path in the tree: `Can't resolve the selector for the item /a.cs`
 * (exit code 1, with no listing of that path; the other paths it was given are listed: `notInTreePaths`). A changeset
 * or branch that isn't there fails otherwise (an empty listing alone, or "does not exist"), never with this.
 */
export function isNotInTreeError(error: unknown): boolean {
  return error instanceof CmError && /can't resolve the selector for the item/i.test(error.message);
}

/**
 * `cm cat serverpath:/a.cs#cs:3` finding nothing: `The specified revision was not found serverpath:/a.cs#cs:3`. It
 * doesn't tell a missing file from one under an xlink, nor from a point that isn't there, so it means the file is
 * absent only where nothing else can be asked (a point whose tree can't be listed: a shelve, a label).
 */
export function isServerPathNotFoundError(error: unknown): boolean {
  return error instanceof CmError && /the specified revision was not found serverpath:/i.test(error.message);
}

/**
 * The paths `cm ls <paths> --tree=<point>` found no such item for (`isNotInTreeError`), one line each: it lists every
 * other path it was given all the same, and exits with 1. Read from all it printed: the error's message is one line.
 */
export function notInTreePaths(error: unknown): string[] {
  if (!(error instanceof CmError)) return [];
  return [...error.command.output.matchAll(/can't resolve the selector for the item (.+?)\s*$/gim)].map((match) => match[1]!);
}
