export interface Changeset {
  id: number;
  guid: string;
  branch: string;
  comment: string;
  owner: string;
  date: string;
  parent: number;
  repository: string;
}

/** A changeset as lists and the Branch Explorer know it; the graph doesn't read the GUID and repository. */
export type ChangesetInfo = Omit<Changeset, 'guid' | 'repository'> & Partial<Pick<Changeset, 'guid' | 'repository'>>;
