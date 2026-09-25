import type { MergePlan, MergeRequest } from '@shared/domain/merge';
import type { ConflictLabels } from './resolve/threeWayMerge';

/** `br:/main/task` → `/main/task`, `cs:12` → `changeset 12`, `lb:v1` → `label v1`, `sh:3` → `shelve 3`. */
export function describeSpec(objectSpec: string): string {
  const [kind, ...rest] = objectSpec.split(':');
  const name = rest.join(':');
  switch (kind) {
    case 'br':
      return name;
    case 'cs':
      return `changeset ${name}`;
    case 'lb':
      return `label ${name}`;
    case 'sh':
      return `shelve ${name}`;
    default:
      return objectSpec;
  }
}

/** What a side is called in words, next to (or instead of) its branch name. */
export interface SideRole {
  /** "Yours", "Incoming". */
  name: string;
  /** "your version", "the incoming version". */
  version: string;
}

/** Branch names for the conflict markers, and the words the page calls each side by. */
export interface MergeLabels extends ConflictLabels {
  roles: { source: SideRole; destination: SideRole };
}

/** In a workspace the destination is the user's own version; merging into a server branch, neither side is. */
export const WORKSPACE_ROLES: MergeLabels['roles'] = {
  source: { name: 'Incoming', version: 'the incoming version' },
  destination: { name: 'Yours', version: 'your version' },
};
const SERVER_ROLES: MergeLabels['roles'] = {
  source: { name: 'Source', version: 'the source version' },
  destination: { name: 'Destination', version: 'the destination version' },
};

/** How the two sides are named everywhere in the merge: branch names when known. */
export function mergeLabels(request: MergeRequest, plan: MergePlan | undefined): MergeLabels {
  return {
    source: request.sourceSpec.startsWith('cs:') ? plan?.contributors?.source.branch || describeSpec(request.sourceSpec) : describeSpec(request.sourceSpec),
    destination: request.destinationBranch ?? plan?.contributors?.destination.branch ?? 'your workspace',
    roles: request.destinationBranch ? SERVER_ROLES : WORKSPACE_ROLES,
  };
}

/** A merge page's title in parts, so each name can be shortened on its own: "Merge" "/main/task" "into" "/main". */
export interface MergeTitle {
  verb: string;
  source: string;
  preposition: string;
  destination: string;
}

export function mergeTitle(request: MergeRequest, destination: string): MergeTitle {
  const source = describeSpec(request.sourceSpec);
  const interval = request.intervalOriginSpec ? `${describeSpec(request.intervalOriginSpec)}…${source}` : source;
  switch (request.kind) {
    case 'merge':
      return request.sourceSpec.startsWith('sh:')
        ? { verb: 'Apply', source, preposition: 'to', destination }
        : { verb: 'Merge', source, preposition: 'into', destination };
    case 'cherryPick':
      return { verb: 'Cherry pick', source: interval, preposition: 'into', destination };
    case 'subtractive':
      return { verb: 'Undo', source: interval, preposition: 'on', destination };
  }
}

/** What the page says once the merge ran: "Merge complete", "Shelve applied". */
export function completionTitle(request: MergeRequest): string {
  switch (request.kind) {
    case 'merge':
      return request.sourceSpec.startsWith('sh:') ? 'Shelve applied' : 'Merge complete';
    case 'cherryPick':
      return 'Cherry pick complete';
    case 'subtractive':
      return 'Changes undone';
  }
}

export function mergeTitleText({ verb, source, preposition, destination }: MergeTitle): string {
  return `${verb} ${source} ${preposition} ${destination}`;
}
