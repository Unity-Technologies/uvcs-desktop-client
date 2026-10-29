import type { BranchInfo } from '@shared/domain/branch';
import type { ChangesetInfo } from '@shared/domain/changeset';
import type { RepositoryVersion } from '@shared/domain/content';
import type { LabelInfo } from '@shared/domain/label';
import type { RevisionRef } from '@shared/domain/revision';
import type { ToolSubject } from '@shared/domain/tools';

/** What a tool runs on, as each menu knows its objects: the repository only where the object names one. */
export const toolSubject = {
  item: (fullPath: string): ToolSubject => ({ kind: 'item', path: fullPath }),
  revision: (revision: RevisionRef, fileName: string): ToolSubject => ({ kind: 'revision', version: { kind: 'revision', revision, fileName }, fileName, repository: revision.repository }),
  /** A version a list of changed files takes out of the repository: a revision, or a path at a changeset. */
  version: (version: RepositoryVersion, fileName: string): ToolSubject => ({ kind: 'revision', version, fileName }),
  changeset: ({ id, branch, repository }: Pick<ChangesetInfo, 'id' | 'branch' | 'repository'>, placeRepository?: string): ToolSubject => ({
    kind: 'changeset',
    id,
    branch,
    ...(withRepository(repository ?? placeRepository)),
  }),
  branch: ({ name, repository }: Pick<BranchInfo, 'name' | 'repository'>): ToolSubject => ({ kind: 'branch', name, ...withRepository(repository) }),
  label: ({ name, repository }: Pick<LabelInfo, 'name' | 'repository'>): ToolSubject => ({ kind: 'label', name, ...withRepository(repository) }),
};

function withRepository(repository: string | undefined): { repository?: string } {
  return repository ? { repository } : {};
}
