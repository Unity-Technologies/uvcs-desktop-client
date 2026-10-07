// Types for protectMainRules.mjs, plain JavaScript so Node runs it as a hook without a build or type stripping.

/** Why `command`, run in `cwd`, would write to main, or null when it wouldn't. */
export function mainBranchViolation(
  command: string,
  cwd: string,
  branchIn: (dir: string) => string | null,
): string | null;

/** The parts of a command line that run one after another. */
export function splitCommandLine(commandLine: string): string[];

/** The branch checked out in `dir`, or null when it isn't a checkout. */
export function checkedOutBranch(dir: string): string | null;
