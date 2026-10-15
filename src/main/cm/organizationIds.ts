// A Unity Cloud organization's server has two names. People use, and `cm` prints and takes almost everywhere, the
// organization's own (`AcmeStudio@unity`); UVCS keeps it underneath by the organization's id (`2398571046213@cloud`).
// Both reach the same server but compare unequal, so the app never shows, compares or passes the id form: it takes
// the server from an output that names it (ARCHITECTURE.md "Unity organizations").

import type { CmClient } from './CmClient';
import { commandLineForLog } from './hideSecrets';

/**
 * `2398571046213@cloud`: a Unity organization's server by its id, as `cm` keeps it underneath. An older cloud
 * organization whose own name is all digits reads the same; it only costs asking `cm` for its name, which is itself.
 */
export function isOrganizationIdServer(server: string): boolean {
  return /^\d+@cloud$/.test(server);
}

/**
 * Whether a command names a Unity organization's server by its id (`game@2398571046213@cloud`), which the app never
 * passes to `cm`. A profile's name is that id form itself, as `cm profile list` prints it.
 */
export function namesOrganizationById(args: readonly string[]): boolean {
  return args[0] !== 'profile' && args.some((arg) => /(?:^|[@='"\s])\d+@cloud(?![.\w])/.test(arg));
}

/** Development builds: warns in the console when a command names a Unity organization's server by its id. */
export function warnOnOrganizationIds(cm: Pick<CmClient, 'onCommandStarted'>): void {
  cm.onCommandStarted(({ args }) => {
    if (!namesOrganizationById(args)) return;
    console.warn(`[organization id] ${commandLineForLog(args)} names a Unity organization's server by its id. See "Unity organizations" in docs/ARCHITECTURE.md.`);
  });
}
