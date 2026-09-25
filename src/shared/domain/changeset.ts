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
