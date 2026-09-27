/** Material Icon Theme's file icons (its folder variants aside) as the build emits them, by name. */
const URLS = import.meta.glob<string>(
  ['../../../../node_modules/material-icon-theme/icons/*.svg', '!../../../../node_modules/material-icon-theme/icons/folder-*.svg'],
  { eager: true, query: '?url', import: 'default' },
);

const PREFIX = '../../../../node_modules/material-icon-theme/icons/';

/** The URL of an icon of the theme by its name, as `fileIconOf` gives it. */
export function materialIconUrl(name: string): string | undefined {
  return URLS[`${PREFIX}${name}.svg`];
}
