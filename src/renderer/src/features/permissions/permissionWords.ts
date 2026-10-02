import type { ObjectPermissions, PermissionTarget } from '@shared/domain/permissions';
import type { OwnState, PermissionResolution } from './aclResolution';
import { sourceLabel } from './permissionTargets';

export const STATE_LABELS: Record<OwnState, string> = { inherit: 'Inherit', allow: 'Allow', deny: 'Deny' };

export const STATE_TIPS: Record<OwnState, string> = {
  inherit: 'Follow what the lists above say',
  allow: 'Allow it here',
  deny: 'Deny it here: a deny wins over any allow',
};

/** The result's word: "Allowed", "Denied", "Not allowed". */
export function effectiveLabel(resolution: PermissionResolution): string {
  return resolution.effective === 'allowed' ? 'Allowed' : resolution.effective === 'denied' ? 'Denied' : 'Not allowed';
}

/** The result in a sentence, where it comes from included: "Allowed by the server", "Denied here". */
export function effectiveSentence(resolution: PermissionResolution): string {
  if (resolution.effective === 'notAllowed') return 'Neither allowed nor denied by this entry: another, such as a group, can still allow it';
  const verb = effectiveLabel(resolution);
  return resolution.source === 'here' ? `${verb} here` : `${verb} by ${sourceLabel(resolution.source!)}`;
}

/** What the lists above say, before this entry's overrides: "Allowed by the server · denied by repository game". */
export function aboveSentence(resolution: PermissionResolution): string {
  const parts = [
    resolution.above.allowedBy && `allowed by ${sourceLabel(resolution.above.allowedBy)}`,
    resolution.above.deniedBy && `denied by ${sourceLabel(resolution.above.deniedBy)}`,
  ].filter(Boolean);
  return parts.length > 0 ? `Above: ${parts.join(' · ')}` : 'Above: neither allowed nor denied';
}

/**
 * What to know before editing an object without a list of its own: it shares its parent's (a branch, its
 * repository's), a path isn't secured, a group of branches doesn't exist yet. Setting a permission changes that.
 */
export function ownListNotice(target: PermissionTarget, permissions: Pick<ObjectPermissions, 'acl' | 'ownAcl'>): string | undefined {
  if (permissions.ownAcl) return undefined;
  if (target.kind === 'path' && target.tag) return 'A new group of branches: setting a permission creates it, on the branches named below.';
  if (target.kind === 'path') return 'Not secured: on its branches this path follows the repository. Setting a permission secures it.';
  return `Shares the permissions of ${sourceLabel(permissions.acl.creator)}: setting one here gives it its own.`;
}

/** An allow here that a deny above beats, which "Allow anyway" (ignoring denies from above) would let through. */
export function losesToDenyAbove(resolution: PermissionResolution): boolean {
  return resolution.own === 'allow' && resolution.effective === 'denied' && resolution.source !== 'here';
}
