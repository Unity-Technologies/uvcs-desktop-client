/**
 * The user info of every URL in a text (`https://ana:token@host`, `https://token@host`: GitHub takes a token as the
 * user alone), up to the last `@` before the host's end, so a password holding `@` goes whole. An SSH remote
 * (`git@github.com:team/game.git`) has no scheme, and an `@` in a path comes after the host: both stay.
 */
const URL_USER_INFO = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/]*@/gi;

/**
 * `text` with each URL's user info replaced by `shownAs`: nothing, to name a remote (`https://github.com/team/game.git`),
 * or a mark that something was hidden there.
 */
export function withoutUrlUserInfo(text: string, shownAs = ''): string {
  return text.replace(URL_USER_INFO, `$1${shownAs}`);
}
