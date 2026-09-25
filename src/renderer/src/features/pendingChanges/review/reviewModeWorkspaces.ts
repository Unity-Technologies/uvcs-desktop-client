/** The workspaces with review mode on, after turning it on or off for one of them. */
export function withReviewMode(workspaces: readonly string[], workspacePath: string, on: boolean): string[] {
  const others = workspaces.filter((path) => path !== workspacePath);
  return on ? [...others, workspacePath] : others;
}
