import type { WorkspaceSelector } from '@shared/domain/workspace';
import { workingObjectName } from '../../components/workingObject';

/**
 * The branch pill's first line: a switch's progress, a placeholder while what the workspace is on isn't known yet,
 * a branch (its name as a path, with its merge request), or anything else by its title (`Label 1.0`, `cs:42`, `sh:3`).
 */
export type WorkingObjectLabel =
  | { kind: 'switching'; text: string }
  | { kind: 'loading' }
  | { kind: 'branch'; title: string }
  | { kind: 'other'; title: string };

export function workingObjectLabel(switching: string | null, selector: WorkspaceSelector | undefined): WorkingObjectLabel {
  if (switching !== null) return { kind: 'switching', text: `${switching}…` };
  if (!selector) return { kind: 'loading' };
  const title = workingObjectTitle(selector);
  return selector.kind === 'branch' ? { kind: 'branch', title } : { kind: 'other', title };
}

/** The pill's title: the branch name as is; `cs:42` and `sh:3` explain themselves, a bare label name doesn't. */
export function workingObjectTitle(selector: WorkspaceSelector): string {
  const name = workingObjectName(selector);
  return selector.kind === 'label' ? `Label ${name}` : name;
}
