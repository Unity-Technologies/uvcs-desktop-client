/** What Go to file searches in a repository: the latest of a branch (Files) or one changeset (Browse repository). */
export type GoToFileScope = { kind: 'branch'; branch: string } | { kind: 'changeset'; changeset: number };

/** How the dialog names what it searches: in its description, and in the notes of a search that finds nothing. */
export interface GoToFileWording {
  name: string;
  description: string;
}

export function goToFileWording(scope: GoToFileScope): GoToFileWording {
  if (scope.kind === 'branch') return { name: scope.branch, description: `In the latest of ${scope.branch}` };
  return { name: `changeset ${scope.changeset}`, description: `At changeset ${scope.changeset}` };
}
