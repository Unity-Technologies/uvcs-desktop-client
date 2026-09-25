import { ArrowRightLeft, FileDiff, GitBranch, GitMerge } from 'lucide-react';
import type { Branch } from '@shared/domain/branch';
import { shortBranchName, spec } from '@shared/domain/specs';
import { PathLabel } from '../../components/PathLabel';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsBadge, DetailsPanel, DetailsSection, DetailsText } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { diffBranch, mergeFromBranch, switchToBranch } from './branchOperations';

interface BranchDetailsProps {
  workspacePath: string;
  branch: Branch;
  isCurrent: boolean;
}

export function BranchDetails({ workspacePath, branch, isCurrent }: BranchDetailsProps) {
  return (
    <DetailsPanel
      icon={<GitBranch />}
      kind="Branch"
      context={branch.parent && <PathLabel path={branch.parent} />}
      title={shortBranchName(branch.name)}
      author={{ user: branch.owner, date: branch.date }}
      badges={
        <>
          {isCurrent && <DetailsBadge tone="success">Current</DetailsBadge>}
          {branch.isHidden && <DetailsBadge>Hidden</DetailsBadge>}
        </>
      }
      actions={
        <>
          {!isCurrent && (
            <Button variant="primary" icon={<ArrowRightLeft size={14} />} onClick={() => void switchToBranch(workspacePath, branch.name)}>
              Switch
            </Button>
          )}
          {!isCurrent && (
            <Button icon={<GitMerge size={14} />} onClick={() => mergeFromBranch(branch.name)}>
              Merge
            </Button>
          )}
          <Button icon={<FileDiff size={14} />} onClick={() => diffBranch(branch.name)}>
            Changes
          </Button>
        </>
      }
    >
      <DetailsSection title="Comment">
        <DetailsText text={branch.comment} placeholder="No comment" />
      </DetailsSection>
      <ChangedFilesSection target={{ kind: 'branch', branch: branch.name }} onOpen={(path) => diffBranch(branch.name, path)} />
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Full name', value: branch.name, mono: true, copyText: branch.name },
            { label: 'Created', value: formatDateTime(branch.date) },
            { label: 'Head', value: `Changeset ${branch.headChangeset}`, copyText: spec.changeset(branch.headChangeset) },
            { label: 'Repository', value: branch.repository },
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={branch.name} objectSpec={spec.branch(branch.name)} />
    </DetailsPanel>
  );
}
