import type { RepositoryLink } from './link';

/**
 * A `cm` spec naming its repository, as a link to its object: `cs:4207@game@acme@unity`, `br:/main/task@game@local`,
 * `lb:v1.2@game@host:8087`, `sh:12@game@acme@unity`, and `cm`'s longer forms (`br:/main@rep:game@repserver:host:8087`).
 * The palette opens one pasted, and the older `plastic://showchangeset=<spec>` links name their object so. Null for
 * any other text, a spec without its repository included: which repository it means depends on where it was copied.
 */
export function specLink(text: string): RepositoryLink | null {
  const match = /^(cs|br|lb|sh):([^@]+)@(?:rep:)?([^@]+)@(?:repserver:)?(.+)$/i.exec(text.trim());
  if (!match) return null;
  const [, prefix = '', name = '', repository = '', server = ''] = match;
  const object = specObject(prefix.toLowerCase(), name);
  return object ? { kind: 'repository', server, repository, object } : null;
}

function specObject(prefix: string, name: string): RepositoryLink['object'] | null {
  switch (prefix) {
    case 'cs':
      return /^\d+$/.test(name) ? { kind: 'changeset', id: Number(name) } : null;
    case 'sh':
      return /^-?\d+$/.test(name) ? { kind: 'shelve', id: Math.abs(Number(name)) } : null;
    case 'br':
      return { kind: 'branch', name: name.startsWith('/') ? name : `/${name}` };
    default:
      return { kind: 'label', name };
  }
}
