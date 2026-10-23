import type { Place } from '@shared/domain/place';
import type { CmRunOptions } from './CmClient';

/**
 * How a server command reaches the place a window shows (`Place`), so each one is written once for both.
 *
 * In a workspace it runs as it always has: in the workspace's folder, which tells `cm` the repository, its arguments
 * as written. With no workspace nothing tells `cm`, so each command names the repository itself, and runs outside every
 * workspace (`outsideWorkspaces`), where one that forgot to fails instead of reading another workspace's:
 * - `cm find` ends with `on repository '<repository>'` (`findCommand`; anywhere else in the query `cm` fails);
 * - object and revision specs end with `@<repository>` (`spec`);
 * - `cm codereview` takes `--repository=<repository>` (`repositoryOption`): without it, outside a workspace, `cm`
 *   fails with "Object reference not set to an instance of an object", after creating the review.
 */
export interface CmPlace {
  /** How a command runs there: in the workspace's folder, or outside every workspace. */
  readonly options: Pick<CmRunOptions, 'cwd' | 'outsideWorkspaces'>;
  /** The repository a command must name, as no folder tells `cm` which: undefined in a workspace. */
  readonly repository: string | undefined;
  /** `cm codereview`'s option naming the repository: none in a workspace. */
  readonly repositoryOption: string[];
  /**
   * A spec as `cm` reads it there: `br:/main`, `cs:12`, `att:status`, `serverpath:/a.cs#cs:12` with `@<repository>`
   * outside a workspace. One naming its repository already (an xlinked item's, `revid:45@lib@local`) stays as it is.
   */
  spec(objectSpec: string): string;
}

export function cmPlace(place: Place): CmPlace {
  if (place.kind === 'workspace') {
    return { options: { cwd: place.workspacePath }, repository: undefined, repositoryOption: [], spec: (objectSpec) => objectSpec };
  }
  const { repository } = place;
  return {
    options: { outsideWorkspaces: true },
    repository,
    repositoryOption: [`--repository=${repository}`],
    spec: (objectSpec) => (namesRepository(objectSpec) ? objectSpec : `${objectSpec}@${repository}`),
  };
}

/**
 * Whether a spec names its repository: an `@` in its object, or in its point after `#` for an item's spec. `@` can't
 * be in a branch, label or attribute name (`cm` reads it as the repository's start), but it can in a file's name
 * (`serverpath:/art/logo@2x.png#cs:12`), so an item's path never counts.
 */
function namesRepository(objectSpec: string): boolean {
  const hash = objectSpec.lastIndexOf('#');
  if (hash >= 0) return objectSpec.includes('@', hash);
  return !/^(?:serverpath:|\/)/.test(objectSpec) && objectSpec.includes('@');
}
