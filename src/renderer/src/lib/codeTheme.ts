/** The highlighting theme of the app's light or dark theme: Pierre's own, which diffs, annotations and comments draw code in. */
export function pierreThemeName(theme: 'light' | 'dark'): 'pierre-light' | 'pierre-dark' {
  return theme === 'dark' ? 'pierre-dark' : 'pierre-light';
}
