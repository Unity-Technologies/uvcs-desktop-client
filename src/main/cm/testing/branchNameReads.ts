import type { BranchNameReads } from '../branchNames';

/** Reads of branch names a test never expects (`BranchNamesCache`): the branch lists it reads answer every name. */
export const NO_BRANCH_NAME_READS: BranchNameReads = {
  every: async () => {
    throw new Error('The branch lists read answer every name.');
  },
  one: async () => {
    throw new Error('The branch lists read answer every name.');
  },
};
