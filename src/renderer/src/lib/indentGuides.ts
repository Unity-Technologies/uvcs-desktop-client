/**
 * The indent guide drawn stronger, as a tree's selection has it: the line under the chevron of the group or folder
 * holding the row at `index` (its own, for an open group or folder), down every row it holds. Rows `from` to `to`
 * (not included) draw it, at `level`. Null at the top level, where nothing holds the row.
 */
export interface ActiveIndentGuide {
  level: number;
  from: number;
  to: number;
}

interface IndentGuideRows<Row> {
  rows: readonly Row[];
  /** How many groups and folders hold a row: the guides it draws, one per level. */
  levelOf: (row: Row) => number;
  /** A group or folder that is open: selecting one shows the guide of what it holds. */
  isOpenHeader: (row: Row) => boolean;
}

/** The guide to draw stronger for the row selected at `index` (-1 for none), as VS Code's explorer does. */
export function activeIndentGuide<Row>({ rows, levelOf, isOpenHeader }: IndentGuideRows<Row>, index: number): ActiveIndentGuide | null {
  const selected = rows[index];
  if (selected === undefined) return null;
  let owner = index;
  if (!isOpenHeader(selected)) {
    const level = levelOf(selected);
    do owner--;
    while (owner >= 0 && levelOf(rows[owner]!) >= level);
    if (owner < 0) return null;
  }
  const level = levelOf(rows[owner]!);
  let to = owner + 1;
  while (to < rows.length && levelOf(rows[to]!) > level) to++;
  return to > owner + 1 ? { level, from: owner + 1, to } : null;
}

/** The level whose guide the row at `index` draws stronger, or undefined. */
export function activeGuideLevelAt(guide: ActiveIndentGuide | null, index: number): number | undefined {
  return guide && index >= guide.from && index < guide.to ? guide.level : undefined;
}
