/**
 * Which branches the Branches filter shows: null is every branch, so branches that appear later
 * (a longer date range, a new branch) show up until the user picks some.
 */
export type BranchChoice = readonly string[] | null;

export function isBranchChosen(choice: BranchChoice, name: string): boolean {
  return choice === null || choice.includes(name);
}

/** Checks or unchecks some branches; checking the last unchecked one goes back to "every branch". */
export function setBranchesChosen(choice: BranchChoice, allBranches: readonly string[], names: readonly string[], chosen: boolean): BranchChoice {
  const current = new Set(choice ?? allBranches);
  for (const name of names) {
    if (chosen) current.add(name);
    else current.delete(name);
  }
  return allBranches.every((name) => current.has(name)) ? null : allBranches.filter((name) => current.has(name));
}
