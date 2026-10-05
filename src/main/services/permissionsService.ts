import type { PermissionsApi } from '@shared/api/permissions';
import { permissionSpec, type ObjectPermissions, type PermissionTarget } from '@shared/domain/permissions';
import { aclCommands, pathBranchesArgs, removePathArgs, setOwnerArgs } from '../cm/aclArgs';
import { listMembersArgs, ownerNamed, parseMemberNames, parseShowOwner } from '../cm/aclMembers';
import { CmError } from '../cm/CmError';
import { isOwnAcl, parseExtendedAcl } from '../cm/extendedAcl';
import type { ServiceContext } from './ServiceContext';

/**
 * Permissions are read and set with full specs (`br:/main@game@local`), so they run from anywhere, the home screen
 * too. Every command is quick: `cm shell` sessions (`query`).
 */
export function createPermissionsService({ cm }: ServiceContext): PermissionsApi {
  async function readAcl(target: PermissionTarget): Promise<Pick<ObjectPermissions, 'acl' | 'ownAcl'>> {
    const spec = permissionSpec(target);
    try {
      const acl = parseExtendedAcl(await cm.query(['showacl', spec, '--extended']));
      return { acl, ownAcl: isOwnAcl(acl.creator, target) };
    } catch (error) {
      if (!isPathNotSecured(target, spec, error)) throw error;
      // A path nobody secured follows its repository: its list is the one setting a permission would start from.
      const repository = { kind: 'repository', server: target.server, repository: target.repository, name: '' } as const;
      return { acl: parseExtendedAcl(await cm.query(['showacl', permissionSpec(repository), '--extended'])), ownAcl: false };
    }
  }

  async function readOwner(target: PermissionTarget): Promise<ObjectPermissions['owner']> {
    if (target.knownOwner) return ownerNamed(target.knownOwner);
    const spec = permissionSpec(target);
    try {
      return parseShowOwner(await cm.query(['showowner', spec]), spec);
    } catch (error) {
      // A path nobody secured has no owner yet; the rest of its permissions still read.
      if (target.kind === 'path') return null;
      throw error;
    }
  }

  return {
    async read(target) {
      const [acl, owner] = await Promise.all([readAcl(target), readOwner(target)]);
      return { ...acl, owner };
    },

    async members(server, kind, filter) {
      return parseMemberNames(await cm.query(listMembersArgs(server, kind, filter)));
    },

    async apply(target, changes) {
      // One command per entry, as `cm acl` takes one user or group; the owner last, since giving the object away can
      // take away the right to change its permissions (through the OWNER entry).
      for (const args of aclCommands(target, changes)) await cm.query(args);
      if (changes.owner) await cm.query(setOwnerArgs(target, changes.owner));
    },

    async removePath(target) {
      await cm.query(removePathArgs(target));
    },

    async editPathBranches(target, { add, remove }) {
      await cm.query(pathBranchesArgs(target, add, remove));
    },
  };
}

/**
 * `cm showacl path:…` fails naming the spec when the path has no permissions of its own ("Incorrect object
 * specification path:/src@game@local"): no `cm` command lists secured paths to ask first.
 */
function isPathNotSecured(target: PermissionTarget, spec: string, error: unknown): boolean {
  return target.kind === 'path' && error instanceof CmError && error.message.includes(spec);
}
