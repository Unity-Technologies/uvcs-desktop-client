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
  /** Full name of the new branch, e.g. `/main/feature`. */
  name: string;
  /** Spec of the starting point: `cs:12`, `lb:v1` or `br:/main` (its head). */
  startingPoint: string;
  comment: string;
  switchToIt: boolean;
}
