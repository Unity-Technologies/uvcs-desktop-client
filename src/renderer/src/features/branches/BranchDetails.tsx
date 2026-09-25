import { FileDiff, GitBranch } from 'lucide-react';
import type { Branch } from '@shared/domain/branch';
import { shortBranchName, spec } from '@shared/domain/specs';
import { useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { PLAIN_LINKS, type ObjectLinks } from '../../components/objectLinks';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsComment } from '../../ui/DetailsComment';
import { DetailsBadge, DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList, type Property } from '../../ui/PropertyList';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
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
      context={branch.parent || undefined}
      title={shortBranchName(branch.name)}
      author={{ user: branch.owner, date: branch.date }}
      badges={
        <>
          {isCurrent && <DetailsBadge tone="success">Current</DetailsBadge>}
          {branch.isHidden && <DetailsBadge>Hidden</DetailsBadge>}
        </>
      }
      primaryAction={
        <Button variant="primary" icon={<FileDiff size={14} />} onClick={() => diffBranch(branch.name)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
    >
      <DetailsComment text={branch.comment} />
      <ChangedFilesSection target={{ kind: 'branch', branch: branch.name }} branchHead={branch.headChangeset} onOpen={(path) => diffBranch(branch.name, path)} />
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Full name', value: branch.name, mono: true, copyText: branch.name },
            { label: 'Created', value: formatDateTime(branch.date) },
            { label: 'Parent', value: branch.parent && links.branch(branch.parent) },
            { label: 'Head', value: links.changeset(branch.headChangeset), copyText: spec.changeset(branch.headChangeset) },
            { label: 'Repository', value: branch.repository },
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={branch.name} objectSpec={spec.branch(branch.name)} />
      {relations.length > 0 && (
        <DetailsSection title="Relations">
          <PropertyList properties={relations} />
        </DetailsSection>
      )}
    </DetailsPanel>
  );
}
