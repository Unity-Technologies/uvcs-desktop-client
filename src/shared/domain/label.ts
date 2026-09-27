export interface Label {
  id: number;
  name: string;
  changeset: number;
  branch: string;
  comment: string;
  owner: string;
  date: string;
  repository: string;
}

/** A label as lists and the Branch Explorer know it; the graph doesn't read its object id. */
export type LabelInfo = Omit<Label, 'id'>;
