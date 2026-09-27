import { FileDiff, GitBranch, House } from 'lucide-react';
import { Fragment } from 'react';
import type { Branch } from '@shared/domain/branch';
import { shortBranchName, spec } from '@shared/domain/specs';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { DetailsHeading } from '../../components/DetailsHeading';
import { PLAIN_LINKS, type ObjectLinks } from '../../components/objectLinks';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsBadge, DetailsPanel } from '../../ui/DetailsPanel';
import type { Property } from '../../ui/PropertyList';
import { AttributeChips } from '../attributes/AttributeChips';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { BranchChip } from './BranchChip';
import { diffBranch } from './branchOperations';

/** A branch as lists and the Branch Explorer know it; the graph doesn't read the repository or ids. */
export type BranchInfo = Omit<Branch, 'id' | 'guid' | 'repository'> & Partial<Pick<Branch, 'repository'>>;

interface BranchDetailsProps {
  branch: BranchInfo;
  /** The branch's context menu, offered behind "More actions". */
  menu: MenuEntry[];
  links?: ObjectLinks;
  /** What the view knows about how it relates to the rest, e.g. its changesets in the graph. */
  relations?: Property[];
}

export function BranchDetails({ branch, menu, links = PLAIN_LINKS, relations = [] }: BranchDetailsProps) {
  const { data: workspace } = useWorkspaceInfo();
  const isCurrent = workspace?.selector.kind === 'branch' && workspace.selector.name === branch.name;

  return (
    <DetailsPanel
      icon={<GitBranch />}
      kind="Branch"
      heading={<DetailsHeading name={shortBranchName(branch.name)} comment={branch.comment} />}
      author={{ user: branch.owner, date: branch.date }}
      meta={[
        branch.parent && (
          <Fragment key="parent">
            from <BranchChip name={branch.parent} onSelect={links.selectBranch} />
          </Fragment>
        ),
      ]}
      badges={
        <>
          {isCurrent && (
            <DetailsBadge tone="accent" tip="Your workspace is on this branch">
              <House size={10} />
              Workspace
            </DetailsBadge>
          )}
          {branch.isHidden && <DetailsBadge>Hidden</DetailsBadge>}
        </>
      }
      attributes={<AttributeChips key={branch.name} objectSpec={spec.branch(branch.name)} />}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => diffBranch(branch)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
      properties={[
        { label: 'Full name', value: branch.name, mono: true, copyText: branch.name },
        { label: 'Created', value: formatDateTime(branch.date) },
        { label: 'Parent', value: branch.parent && links.branch(branch.parent) },
        { label: 'Head', value: links.changeset(branch.headChangeset), copyText: spec.changeset(branch.headChangeset) },
        { label: 'Repository', value: branch.repository },
        ...relations,
      ]}
      changes={<ChangedFilesSection target={{ kind: 'branch', branch: branch.name }} branchHead={branch.headChangeset} onOpen={(path) => diffBranch(branch, path)} />}
    />
  );
}
