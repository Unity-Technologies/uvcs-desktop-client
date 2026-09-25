export interface Branch {
  id: number;
  /** Full name, e.g. `/main/feature`. */
  name: string;
  parent: string;
  comment: string;
  owner: string;
  date: string;
  headChangeset: number;
  guid: string;
  repository: string;
  isHidden?: boolean;
}

export interface CreateBranchRequest {
  /** Full name of the new branch: `/main/feature` for a child branch, `/feature` for a top-level one. */
  name: string;
  /** Where the branch starts: a changeset (`cs:12`) or a label (`lb:v1`) spec; the head of the parent branch when omitted. */
  startingPoint?: string;
  comment: string;
}
