import type { OutgoingHttpHeaders } from 'node:http';
import type { AppUpdater } from 'electron-updater';

/** The header electron-updater sends the staging user id in, with every check (`getUpdateInfoAndProvider`). */
const STAGING_USER_ID_HEADER = 'x-user-staging-id';

/**
 * The two members of electron-updater's `AppUpdater` this replaces: `stagingUserIdPromise` (protected) creates the id
 * in `<userData>/.updaterId` on first use, and `computeFinalHeaders` (private) builds the headers of every request,
 * the check's with the id. The types hide them, hence this shape; `withoutStagingUserId.test.ts` runs against the real
 * `AppUpdater`, so an upgrade that renames or reworks them fails there instead of sending the id again.
 *
 * Resolving the id to '' is safe only because `isUserWithinRollout` is replaced too: the default, `isStagingMatch`,
 * reads that id as a UUID, and '' reads as all zeros, so it would let every user into a release staged above 0% and
 * keep every user out of one staged at 0%, by accident rather than by decision.
 */
interface StagingInternals {
  stagingUserIdPromise: { readonly value: Promise<string> };
  computeFinalHeaders(headers: OutgoingHttpHeaders): OutgoingHttpHeaders;
}

/**
 * Makes an update check a standard request that identifies no one. electron-updater gives each installation a random
 * id (`getOrCreateStagingUserId`, kept in `.updaterId`) and sends it as `x-user-staging-id` with every check, only
 * so a release can reach a share of users (`stagingPercentage` in `latest*.yml`, `isStagingMatch`). The app's
 * releases never stage, so this drops the header (none at all, not an empty one), never creates the id, and lets every
 * release reach everyone (`isUserWithinRollout`).
 *
 * This turns staged rollouts off: a release that wanted them would need another way to pick its share of users.
 *
 * Patching the one `autoUpdater` instance is less fragile than the alternatives: subclassing would mean picking the
 * platform updater ourselves (`NsisUpdater`, `MacUpdater`, `AppImageUpdater`, `DebUpdater`… as electron-updater's
 * `doLoadAutoUpdater` does), and `requestHeaders` can't remove the header, since `computeFinalHeaders` only adds them.
 */
export function withoutStagingUserId(updater: AppUpdater): void {
  updater.isUserWithinRollout = () => true;
  const internals = updater as unknown as StagingInternals;
  // Read only to fill the header dropped below; resolved here so `.updaterId` is never created.
  internals.stagingUserIdPromise = { value: Promise.resolve('') };
  const computeFinalHeaders = internals.computeFinalHeaders.bind(updater);
  internals.computeFinalHeaders = (headers) => {
    const sent = { ...headers };
    delete sent[STAGING_USER_ID_HEADER];
    return computeFinalHeaders(sent);
  };
}
