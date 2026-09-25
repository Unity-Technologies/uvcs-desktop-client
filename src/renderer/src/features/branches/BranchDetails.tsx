import { ArrowRightLeft, FileDiff, GitBranch, GitMerge } from 'lucide-react';
import type { Branch } from '@shared/domain/branch';
import { spec } from '@shared/domain/specs';
import { formatDateTime } from '../../lib/formatDate';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { DetailsPanel, DetailsSection, DetailsText, PropertyList } from '../../ui/DetailsPanel';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { diffBranch, mergeFromBranch, switchToBranch } from './branchOperations';

interface BranchDetailsProps {
  workspacePath: string;
  branch: Branch;
  isCurrent: boolean;
}

export function BranchDetails({ workspacePath, branch, isCurrent }: BranchDetailsProps) {
  return (
    <DetailsPanel
      icon={<GitBranch size={18} />}
      title={branch.name}
      subtitle={isCurrent ? 'Your workspace is on this branch' : branch.isHidden ? 'Hidden branch' : undefined}
      actions={
        <>
          {!isCurrent && (
            <Button size="small" variant="primary" icon={<ArrowRightLeft size={13} />} onClick={() => void switchToBranch(workspacePath, branch.name)}>
              Switch
            </Button>
          )}
          {!isCurrent && (
            <Button size="small" icon={<GitMerge size={13} />} onClick={() => mergeFromBranch(branch.name)}>
              Merge
            </Button>
          )}
          <Button size="small" icon={<FileDiff size={13} />} onClick={() => diffBranch(branch.name)}>
            Changes
          </Button>
        </>
      }
    >
      <DetailsSection title="Comment">
        <DetailsText text={branch.comment} placeholder="No comment" />
      </DetailsSection>
      <DetailsSection title="Properties">
        <PropertyList
          properties={[
            ['Created by', <UserLabel user={branch.owner} />],
            ['Created', formatDateTime(branch.date)],
            ['Parent', branch.parent],
            ['Head', `Changeset ${branch.headChangeset}`],
            ['Repository', branch.repository],
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={branch.name} objectSpec={spec.branch(branch.name)} />
    </DetailsPanel>
  );
}
