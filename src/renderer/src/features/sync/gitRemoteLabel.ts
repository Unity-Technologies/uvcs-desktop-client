/** A URL's user info (`https://user:token@host`): a token pasted into a Git URL may be the user alone. */
const USER_INFO = /^([a-z][a-z0-9+.-]*:\/\/)[^\s/@]*@/i;

/**
 * How the app names a Git remote in titles and toasts: the URL as typed, without its user info, which may carry a
 * password or a token (`https://ana:ghp_…@github.com/team/game.git` reads `https://github.com/team/game.git`). An
 * SSH remote (`git@github.com:team/game.git`) names only its account and stays as it is.
 */
export function gitRemoteLabel(url: string): string {
  return url.replace(USER_INFO, '$1');
}
