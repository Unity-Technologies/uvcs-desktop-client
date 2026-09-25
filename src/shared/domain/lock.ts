export type LockStatus = 'Locked' | 'Retained';

export interface Lock {
  itemId: number;
  guid: string;
  /** Server path of the locked item, e.g. `/art/hero.psd`. */
  path: string;
  owner: string;
  workspace: string;
  status: LockStatus;
  date: string;
  /** Branch where the lock is released when the change arrives. */
  destinationBranch: string;
  /** Branch holding the locked revision. */
  holderBranch: string;
  repository: string;
}
