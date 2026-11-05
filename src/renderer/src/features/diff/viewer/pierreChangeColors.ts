/**
 * The colors Pierre (1.6.2) tints a diff's removed and added rows with (`--diffs-bg-deletion`, `--diffs-bg-addition`,
 * what a changed row's background is), and the translucent color it lays over them to mark the words that changed
 * (`--diffs-bg-deletion-emphasis`, `--diffs-bg-addition-emphasis`), on its `diffs-container` host. Pierre takes them
 * from the syntax theme (`gitDecoration.deletedResourceForeground` or `terminal.ansiRed`, and the added ones, mixed
 * into the background), its own defaults only when the theme has none. Read as the host computes them, with the host's
 * `color-scheme`, which picks the side of the `light-dark()` they hold: the change map (`ChangeMap`) fills its blocks
 * with the changed words' color over the row's tint, a little darker than the changed rows beside it in any theme.
 */
export interface ChangeColors {
  deleted: string;
  added: string;
  /** The translucent color Pierre lays over a changed row's tint to mark the words that changed. */
  deletedWords: string;
  addedWords: string;
  colorScheme: string;
}

export function pierreChangeColors(fileContainer: Element): ChangeColors {
  const style = getComputedStyle(fileContainer);
  return {
    deleted: style.getPropertyValue('--diffs-bg-deletion').trim(),
    added: style.getPropertyValue('--diffs-bg-addition').trim(),
    deletedWords: style.getPropertyValue('--diffs-bg-deletion-emphasis').trim(),
    addedWords: style.getPropertyValue('--diffs-bg-addition-emphasis').trim(),
    colorScheme: style.colorScheme,
  };
}

export function sameChangeColors(a: ChangeColors | undefined, b: ChangeColors | undefined): boolean {
  return (
    a?.deleted === b?.deleted &&
    a?.added === b?.added &&
    a?.deletedWords === b?.deletedWords &&
    a?.addedWords === b?.addedWords &&
    a?.colorScheme === b?.colorScheme
  );
}
