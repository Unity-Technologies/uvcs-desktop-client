/** Fewer ORed conditions than this show whole. */
const FOLD_FROM = 4;

/** `targetid = 1 or targetid = 2 or …`: one field compared again and again, joined by `or`. */
const ORED_RUN = /\b([a-z]+) = ('[^']*'|\d+)(?: or \1 = (?:'[^']*'|\d+)){3,}/gi;

/**
 * A command line as the command log shows it: a long run of the same condition ORed (the reviews of a block of
 * branches, `branchTargetsCondition`: up to 50 `targetid`s) folds to its first and last, with how many are between
 * ("targetid = 31215326 or …48 more… or targetid = 31222103"). Copy and the filter still take the whole line.
 */
export function foldedCommandLine(line: string): string {
  return line.replace(ORED_RUN, (run: string) => {
    const conditions = run.split(' or ');
    if (conditions.length < FOLD_FROM) return run;
    return `${conditions[0]} or …${conditions.length - 2} more… or ${conditions.at(-1)}`;
  });
}
