import {
  ALL_KEYWORD_PERMISSIONS,
  PERMISSION_NAMES,
  type AclBits,
  type AclEntry,
  type AclLevel,
  type PermissionName,
  type PermissionTarget,
} from '@shared/domain/permissions';

/**
 * `cm showacl <spec> --extended`: the object's access control list and the ones it inherits from, as an indented tree.
 *
 * It is read as text because no machine format holds it all: `--xml` prints only who is allowed and denied what (the
 * overrides read as neither), and `--extended --xml` fails in cm 11 ("ExtendedAclInfo is inaccessible due to its
 * protection level"). Its words are written in `cm`'s code, never localized (`ExtendedAclDisplayInfo`):
 *
 * ```
 *   ACL: 4136
 *     Creator br:/main@rep:codice@repserver:codice@cloud
 *     Entries
 *      Developers:
 *        Denied:
 *         ci
 *        Override Allowed:
 *         ci
 *     Inherited
 *       ACL: 0
 *         Creator rep:codice@repserver:codice@cloud
 *         …
 * ```
 *
 * A list starts at its `ACL:` line, the lists it inherits from are indented under it; a member's line ends with `:`
 * and its categories are indented further. `all` stands for `ALL_KEYWORD_PERMISSIONS`; names `cm` knows that the app
 * doesn't (`purge`) are left out. Output that holds no list fails, rather than reading as no permissions.
 */
export function parseExtendedAcl(output: string): AclLevel {
  const stack: { indent: number; level: AclLevel }[] = [];
  let root: AclLevel | undefined;
  let member: { indent: number; entry: AclEntry } | undefined;
  let category: keyof AclBits | undefined;

  for (const line of output.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    const indent = line.length - line.trimStart().length;

    if (/^ACL:\s/.test(text)) {
      while (stack.length > 0 && stack.at(-1)!.indent >= indent) stack.pop();
      const level: AclLevel = { creator: '', entries: [], inherited: [] };
      if (stack.length === 0) root ??= level;
      else stack.at(-1)!.level.inherited.push(level);
      stack.push({ indent, level });
      member = undefined;
      category = undefined;
      continue;
    }

    const current = stack.at(-1)?.level;
    if (!current) continue;
    const heading = text.endsWith(':') ? text.slice(0, -1) : undefined;
    if (current.creator === '' && text.startsWith('Creator ')) {
      current.creator = text.slice('Creator '.length).trim();
    } else if (text === 'Entries' || text === 'Inherited') {
      member = undefined;
      category = undefined;
    } else if (heading !== undefined && member && indent > member.indent && CATEGORIES[heading]) {
      category = CATEGORIES[heading];
    } else if (heading !== undefined) {
      const entry: AclEntry = { member: heading, bits: { allowed: [], denied: [], overrideAllowed: [], overrideDenied: [] } };
      current.entries.push(entry);
      member = { indent, entry };
      category = undefined;
    } else if (member && category) {
      member.entry.bits[category] = unionInOrder(member.entry.bits[category], permissionsNamed(text.split(/\s+/)));
    }
  }

  if (!root) throw new Error(`cm showacl printed no access control list:\n${output.trim()}`);
  return root;
}

const CATEGORIES: Record<string, keyof AclBits> = {
  Allowed: 'allowed',
  Denied: 'denied',
  'Override Allowed': 'overrideAllowed',
  'Override Denied': 'overrideDenied',
};

function permissionsNamed(names: string[]): PermissionName[] {
  return names.flatMap((name) => (name === 'all' ? ALL_KEYWORD_PERMISSIONS : isPermissionName(name) ? [name] : []));
}

function isPermissionName(name: string): name is PermissionName {
  return (PERMISSION_NAMES as readonly string[]).includes(name);
}

/** The permissions of both, once each, in `cm`'s order. */
export function unionInOrder(a: readonly PermissionName[], b: readonly PermissionName[]): PermissionName[] {
  return PERMISSION_NAMES.filter((name) => a.includes(name) || b.includes(name));
}

/**
 * Whether the first list `cm showacl` printed is the object's own. One that shares its parent's list (a branch nobody
 * set permissions on) shows the parent's as the first, its creator naming the parent. Only the kind and the name are
 * compared: `cm` may print another server in a creator's spec (the client's default one) than the object's.
 */
export function isOwnAcl(creator: string, target: PermissionTarget): boolean {
  const prefix = CREATOR_PREFIXES[target.kind];
  if (!creator.startsWith(prefix)) return false;
  if (target.kind === 'server') return true;
  const rest = creator.slice(prefix.length);
  if (target.kind === 'repository') return rest.slice(0, rest.indexOf('@repserver:')) === target.name;
  const name = rest.slice(0, rest.lastIndexOf('@rep:'));
  return name === (target.kind === 'path' && target.tag ? `${target.name}#${target.tag}` : target.name);
}

const CREATOR_PREFIXES: Record<PermissionTarget['kind'], string> = {
  server: 'repserver:',
  repository: 'rep:',
  branch: 'br:',
  label: 'lb:',
  attribute: 'att:',
  path: 'path:',
};
