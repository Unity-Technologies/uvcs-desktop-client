/**
 * A revision by its id in the repository that holds it. Revision ids are per repository, and an item under an xlink
 * lives in the xlinked repository (`unityGUI@codice@cloud`), not the workspace's: an id means nothing without it.
 */
export interface RevisionRef {
  revisionId: number;
  /** `name@server`, as `cm` names it for the item, e.g. `unityGUI@codice@cloud`. */
  repository: string;
}

/** Just the revision of something that names one (a tree item, a history's revision), to key queries and cross IPC. */
export function revisionRef({ revisionId, repository }: RevisionRef): RevisionRef {
  return { revisionId, repository };
}

/** A revision of an item of `repository`; none for a negative id (-1: the item isn't on that side). */
export function revisionIn(repository: string, revisionId: number): RevisionRef | null {
  return revisionId < 0 ? null : { revisionId, repository };
}
