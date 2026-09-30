import { CmError } from './CmError';

/** How the server starts an ITEMS_ALREADY_LOCKED error, followed by one `<server path> (wk:<workspace> owner:<user>)` line per item. */
const LOCKED_ITEMS_HEADER = 'These items are exclusively checked out by:';
const LOCKED_ITEM_LINE = /^(.+?) \(wk:(.*) owner:(.*)\)$/;

/** What the lock stood in the way of. */
export type LockedAction = 'checked out' | 'checked in';

export interface LockedItem {
  /** Server path, e.g. `/art/Hero.fbx`. */
  path: string;
  workspace: string;
  owner: string;
}

/** The items someone else has exclusively checked out, from a failed checkout or checkin; null for any other failure. */
export function parseLockedItems(message: string): LockedItem[] | null {
  const start = message.indexOf(LOCKED_ITEMS_HEADER);
  if (start < 0) return null;
  const items = message
    .slice(start + LOCKED_ITEMS_HEADER.length)
    .split(/\r?\n/)
    .map((line) => LOCKED_ITEM_LINE.exec(line.trim()))
    .filter((match) => match !== null)
    .map(([, path, workspace, owner]) => ({ path: path!, workspace: workspace!, owner: owner! }));
  return items.length > 0 ? items : null;
}

/** Says who holds the locks and what that means, e.g. "Hero.fbx is locked by ana (workspace ana-wk)…". */
export function describeLockedItems(items: LockedItem[], action: LockedAction): string {
  if (items.length === 1) {
    const [{ path, workspace, owner }] = items as [LockedItem];
    return `${fileName(path)} is locked by ${owner} (workspace ${workspace}), so it can't be ${action} until the lock is released.`;
  }
  const lines = items.map(({ path, owner }) => `${path} — ${owner}`);
  return [`${items.length} items are locked by others, so they can't be ${action} until the locks are released:`, ...lines].join('\n');
}

/**
 * Runs `work`, turning a "these items are exclusively checked out" failure into a message that reads. The items are
 * read from the command's whole output: a `CmError`'s message is only one line of it (`extractErrorMessage`).
 */
export async function explainLockedItems<T>(action: LockedAction, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const items = error instanceof CmError ? parseLockedItems(error.command.output) : null;
    if (!items || !(error instanceof CmError)) throw error;
    throw error.withMessage(describeLockedItems(items, action));
  }
}

function fileName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path;
}
