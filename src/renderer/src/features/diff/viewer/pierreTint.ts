/**
 * A color as Pierre tints a row with it: mixed into the diff's background, `light`% of the background in the light
 * theme and `dark`% in the dark one, as Pierre's own added and removed lines are (88 and 80 for a line, 91 and 85 for
 * its gutter). For CSS given to Pierre (`unsafeCSS`), whose rows read `--diffs-bg`.
 */
export function pierreTint(color: string, light: number, dark: number): string {
  return `light-dark(color-mix(in lab,var(--diffs-bg) ${light}%,${color}),color-mix(in lab,var(--diffs-bg) ${dark}%,${color}))`;
}
