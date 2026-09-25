import { trimFolderToFit } from '../../../lib/trimToFit';

/** How many characters the source's branch gets in its label before whole folders are dropped from its middle. */
const LABEL_CHARS = 40;

/**
 * Styles for Pierre's conflict view that read as two labeled blocks instead of Git markers: the `<<<<<<<` and
 * `>>>>>>>` rows go (the header above the conflict names the destination's side), and the `=======` row becomes the
 * source's label, "Incoming /main/…/task", tinted like its lines.
 */
export function conflictHunkCss(sourceRole: string, sourceBranch: string): string {
  const tint = (color: string, light: number, dark: number): string =>
    `light-dark(color-mix(in lab,var(--diffs-bg) ${light}%,${color}),color-mix(in lab,var(--diffs-bg) ${dark}%,${color}))`;
  return [
    '[data-merge-conflict=marker-start],[data-gutter-buffer=merge-conflict-marker-start],[data-merge-conflict=marker-end],[data-gutter-buffer=merge-conflict-marker-end]{display:none}',
    `[data-merge-conflict-actions],[data-gutter-buffer=merge-conflict-action]{--diffs-computed-decoration-bg:${tint('var(--diffs-addition-base)', 88, 80)}}`,
    `[data-merge-conflict=marker-separator],[data-gutter-buffer=merge-conflict-marker-separator]{--diffs-computed-decoration-bg:${tint('var(--diffs-modified-base)', 88, 80)}}`,
    '[data-merge-conflict=marker-separator]{display:flex;align-items:center;gap:6px;min-height:1.75rem;padding-inline:.5rem;font-size:0;font-family:var(--diffs-header-font-family,var(--diffs-header-font-fallback));user-select:none}',
    `[data-merge-conflict=marker-separator]::before{content:${cssString(sourceRole)};font-size:.75rem;font-weight:600;color:var(--diffs-modified-base)}`,
    `[data-merge-conflict=marker-separator]::after{content:${cssString(shortenBranch(sourceBranch))};font-size:.75rem;color:var(--diffs-fg-number);white-space:nowrap}`,
  ].join('');
}

/** `/main/…/child_1/task`: the first and last folders kept, measured in characters (CSS content can't be measured). */
export function shortenBranch(branch: string): string {
  const nameStart = branch.lastIndexOf('/') + 1;
  const name = branch.slice(nameStart);
  return trimFolderToFit(branch.slice(0, nameStart), LABEL_CHARS - name.length, (text) => text.length) + name;
}

function cssString(text: string): string {
  return `"${text.replace(/[\\"]/g, '\\$&').replace(/[\r\n]+/g, ' ')}"`;
}
