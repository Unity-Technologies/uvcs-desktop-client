import type { BringDisabledReason, LeaveDisabledReason } from '@shared/domain/switchWithChanges';
import type { SelectorKind, WorkspaceSelector } from '@shared/domain/workspace';

const KINDS_BY_PREFIX: Record<string, SelectorKind> = { br: 'branch', cs: 'changeset', lb: 'label', sh: 'shelve' };

export interface ParsedSpec {
  selector: WorkspaceSelector;
  /** The repository named in the spec (`br:/main@other@server` → `other`), if any. */
  repositoryName?: string;
}

/** Parses a switch target such as `br:/main/t2`, `cs:12`, `lb:v1@repo@server` or a bare branch name. */
export function parseSelectorSpec(spec: string): ParsedSpec {
  const prefix = /^(br|cs|lb|sh):/.exec(spec);
  const [name = '', repositoryName] = (prefix ? spec.slice(prefix[0].length) : spec).split('@');
  return { selector: { kind: prefix ? KINDS_BY_PREFIX[prefix[1]!]! : 'branch', name }, repositoryName };
}

/** How the user sees a selector: `/main/t1`, `changeset 12`, `label v1`, `shelve 4`. */
export function describeSelector(selector: WorkspaceSelector): string {
  return selector.kind === 'branch' ? selector.name : `${selector.kind} ${selector.name}`;
}

/**
 * Changes can only come along to a target they can be merged onto: not a label (a fixed snapshot),
 * not a shelve, and not another repository.
 */
export function bringDisabledReason(targetSpec: string, workspaceRepositoryName: string): BringDisabledReason | undefined {
  const { selector, repositoryName } = parseSelectorSpec(targetSpec);
  if (repositoryName && repositoryName !== workspaceRepositoryName) return 'otherRepository';
  if (selector.kind === 'label') return 'label';
  if (selector.kind === 'shelve') return 'shelve';
  return undefined;
}

/** Changes can only stay behind where a shelve comment can name the place they were made: not on a shelve. */
export function leaveDisabledReason(source: WorkspaceSelector): LeaveDisabledReason | undefined {
  return source.kind === 'shelve' ? 'shelveSource' : undefined;
}
