/**
 * What the table does about the selection kept from an earlier visit as its rows change: show it once its row is in
 * (`reveal`, until that worked), and again after the rows were all gone and came back, filters cleared (`forget`).
 */
export function anchorRevealStep(rowCount: number, revealed: boolean): 'forget' | 'reveal' | 'none' {
  if (rowCount === 0) return 'forget';
  return revealed ? 'none' : 'reveal';
}
