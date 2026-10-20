export const VIEW_IDS = [
  'changes',
  'incoming',
  'files',
  'changesets',
  'branchExplorer',
  'branches',
  'labels',
  'shelves',
  'attributes',
  'codeReviews',
  'locks',
  'sync',
] as const;

export type ViewId = (typeof VIEW_IDS)[number];

/** Whether `value`, read from outside the page (its address), names a view. */
export function isViewId(value: string): value is ViewId {
  return (VIEW_IDS as readonly string[]).includes(value);
}

/**
 * The command that goes to a view (⌘1…, the palette, the menu bar). A page window sends it to its workspace window
 * by this id (`windows.showWorkspaceWindow`), which runs it as its own.
 */
export function viewCommandId(view: ViewId): string {
  return `goto.${view}`;
}
