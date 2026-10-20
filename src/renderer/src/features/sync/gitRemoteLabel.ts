import { withoutUrlUserInfo } from '@shared/urlUserInfo';

/**
 * How the app names a Git remote in titles and toasts: the URL as typed, without its user info, which may carry a
 * password or a token (`https://ana:ghp_…@github.com/team/game.git` reads `https://github.com/team/game.git`). An
 * SSH remote (`git@github.com:team/game.git`) names only its account and stays as it is.
 */
export function gitRemoteLabel(url: string): string {
  return withoutUrlUserInfo(url);
}
