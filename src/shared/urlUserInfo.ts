/**
 * The user info of every URL in a text (`https://ana:token@host`, `https://token@host`: GitHub takes a token as the
 * user alone), up to the last `@` before the host's end, so a password holding `@` goes whole. The search stops at
 * what ends a host or can't be in one (`/ ? #`, space, quotes, `< > \ ,`), so a URL with no path is never read up to
 * an `@` after it (`"https://github.com","ana@corp.com"`); a password holding one of those, unusual in a URL, isn't
 * found. An scp-like SSH remote (`git@github.com:team/game.git`) has no scheme and stays; an `ssh://` URL loses its
 * user as any other. The scheme is at most 32 characters, which keeps a long run of letters and dashes from costing
 * a search at every one of them.
 */
const URL_USER_INFO = /([a-z][a-z0-9+.-]{0,31}:\/\/)[^\s/?#"'<>\\,]*@/gi;

/**
 * `text` with each URL's user info replaced by `shownAs`: nothing, to name a remote (`https://github.com/team/game.git`),
 * or a mark that something was hidden there.
 */
export function withoutUrlUserInfo(text: string, shownAs = ''): string {
  return text.replace(URL_USER_INFO, `$1${shownAs}`);
}
