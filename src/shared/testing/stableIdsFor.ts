import { parseBranchGuid, parseProjectGuid, parseRepositoryGuid, parseShelveGuid, type BranchGuid, type ProjectGuid, type RepositoryGuid, type ShelveGuid } from '../domain/stableIds';

// GUIDs for tests, shaped as `cm` prints them, told apart by a number: `repositoryGuidFor(1)` is
// `00000000-0000-4000-8000-000000000001`, `branchGuidFor(1)` `00000000-0000-4000-9000-000000000001`,
// `shelveGuidFor(1)` `00000000-0000-4000-a000-000000000001`, `projectGuidFor(1)` `00000000-0000-4000-b000-000000000001`.

export function repositoryGuidFor(number: number): RepositoryGuid {
  return parseRepositoryGuid(`00000000-0000-4000-8000-${String(number).padStart(12, '0')}`)!;
}

export function branchGuidFor(number: number): BranchGuid {
  return parseBranchGuid(`00000000-0000-4000-9000-${String(number).padStart(12, '0')}`)!;
}

export function shelveGuidFor(number: number): ShelveGuid {
  return parseShelveGuid(`00000000-0000-4000-a000-${String(number).padStart(12, '0')}`)!;
}

export function projectGuidFor(number: number): ProjectGuid {
  return parseProjectGuid(`00000000-0000-4000-b000-${String(number).padStart(12, '0')}`)!;
}
