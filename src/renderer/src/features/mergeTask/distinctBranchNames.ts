/**
 * Two branches named as briefly as tells them apart: their last segments (`subtask`, `child_1`), or as many trailing
 * segments as it takes when those are the same (`a/fix`, `b/fix`).
 */
export function distinctBranchNames(first: string, second: string): [string, string] {
  const firstParts = first.split('/').filter(Boolean);
  const secondParts = second.split('/').filter(Boolean);
  const longest = Math.max(firstParts.length, secondParts.length);
  for (let kept = 1; kept < longest; kept++) {
    const [a, b] = [firstParts.slice(-kept).join('/'), secondParts.slice(-kept).join('/')];
    if (a !== b) return [a, b];
  }
  return [first, second];
}
