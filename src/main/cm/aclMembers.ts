import { EVERYONE, type MemberKind, type MemberRef } from '@shared/domain/permissions';

/**
 * `cm showowner <spec>`: the spec as given, padded, then the owner and its kind, `User` or `Group`
 * (`br:/main@game@local   ana@corp.com User`). A group's name may hold spaces, so the owner is what lies between the
 * spec and the last word. The server owned by everyone prints its owner as `all`. Null when it can't be read.
 */
export function parseShowOwner(output: string, spec: string): MemberRef | null {
  const line = output
    .split(/\r?\n/)
    .map((text) => text.trim())
    .find((text) => text.length > 0);
  if (!line) return null;
  const rest = (line.startsWith(spec) ? line.slice(spec.length) : line.slice(line.indexOf(' ') + 1)).trim();
  const lastSpace = rest.lastIndexOf(' ');
  if (lastSpace <= 0) return null;
  return ownerNamed(rest.slice(0, lastSpace).trim(), rest.slice(lastSpace + 1) === 'Group' ? 'group' : 'user');
}

/** An owner as a list names it (`cm find`'s `{owner}`): `all` is everyone. */
export function ownerNamed(name: string, kind: MemberKind = 'user'): MemberRef {
  return name === 'all' ? { name: EVERYONE, kind: 'group' } : { name, kind };
}

/** `cm listusers <server> --onlyusers|--onlygroups`: one name a line, which may hold spaces. */
export function parseMemberNames(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** `cm listusers` for one kind of member, only those containing `filter` when given (the server filters). */
export function listMembersArgs(server: string, kind: MemberKind, filter?: string): string[] {
  return ['listusers', server, kind === 'group' ? '--onlygroups' : '--onlyusers', ...(filter ? [`--filter=${filter}`] : [])];
}
