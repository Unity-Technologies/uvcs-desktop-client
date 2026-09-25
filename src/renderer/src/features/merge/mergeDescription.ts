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

/** How the two sides are named everywhere in the merge: branch names when known. */
export function mergeLabels(request: MergeRequest, plan: MergePlan | undefined): ConflictLabels {
  return {
    source: request.sourceSpec.startsWith('cs:') ? plan?.contributors?.source.branch || describeSpec(request.sourceSpec) : describeSpec(request.sourceSpec),
    destination: request.destinationBranch ?? plan?.contributors?.destination.branch ?? 'your workspace',
  };
}

export function mergeTitle(request: MergeRequest, destination: string): string {
  const source = describeSpec(request.sourceSpec);
  switch (request.kind) {
    case 'merge':
      return request.sourceSpec.startsWith('sh:') ? `Apply ${source} to ${destination}` : `Merge ${source} into ${destination}`;
    case 'cherryPick':
      return request.intervalOriginSpec
        ? `Cherry pick ${describeSpec(request.intervalOriginSpec)}…${source} into ${destination}`
        : `Cherry pick ${source} into ${destination}`;
    case 'subtractive':
      return request.intervalOriginSpec
        ? `Undo ${describeSpec(request.intervalOriginSpec)}…${source} on ${destination}`
        : `Undo ${source} on ${destination}`;
  }
}
