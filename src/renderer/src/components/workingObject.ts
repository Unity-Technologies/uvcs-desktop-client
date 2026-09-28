import type { SelectorKind, WorkspaceSelector } from '@shared/domain/workspace';
import { Archive, GitBranch, GitCommitVertical, Tag } from 'lucide-react';
import type { Icon } from '../lib/actions';

export const SELECTOR_KIND_LABELS: Record<SelectorKind, string> = {
  branch: 'Branch',
  changeset: 'Changeset',
  label: 'Label',
  shelve: 'Shelve',
};

export const SELECTOR_ICONS: Record<SelectorKind, Icon> = {
  branch: GitBranch,
  changeset: GitCommitVertical,
  label: Tag,
  shelve: Archive,
};

/** What the workspace is loaded from, as users write it: `/main/task`, `cs:12`, `v1.0` or `sh:3`. */
export function workingObjectName(selector: WorkspaceSelector): string {
  switch (selector.kind) {
    case 'changeset':
      return `cs:${selector.name}`;
    case 'shelve':
      return `sh:${selector.name}`;
    default:
      return selector.name;
  }
}
