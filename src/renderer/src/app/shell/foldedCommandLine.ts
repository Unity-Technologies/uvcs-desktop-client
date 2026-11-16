/** Fewer ORed conditions than this show whole. */
const FOLD_FROM = 4;

/** `targetid = 1 or targetid = 2 or …`: one field compared again and again, joined by `or`. */
const ORED_RUN = /\b([a-z]+) = ('[^']*'|\d+)(?: or \1 = (?:'[^']*'|\d+)){3,}/i;

/**
 * A command line folded around its long run of one field's ORed conditions (a block of branches' reviews,
 * `branchTargetsCondition`: up to 50 `targetid`s): the line up to the run's first condition, how many are left out,
 * and the rest from its last ("targetid = 31215326 or" … 48 … "or targetid = 31222103) and …").
 */
export interface FoldedCommandLine {
  head: string;
  hidden: number;
  tail: string;
}

/**
 * How the command log shows a line, collapsed until the user expands it: folded around its first long run of ORed
 * conditions, or none for a line without one. Copy and the filter still take the whole line.
 */
export function foldedCommandLine(line: string): FoldedCommandLine | undefined {
  const run = ORED_RUN.exec(line);
  if (!run) return undefined;
  const conditions = run[0].split(' or ');
  if (conditions.length < FOLD_FROM) return undefined;
  const start = run.index;
  return {
    head: `${line.slice(0, start)}${conditions[0]} or `,
    hidden: conditions.length - 2,
    tail: ` or ${conditions.at(-1)}${line.slice(start + run[0].length)}`,
  };
}
