import { FileDiff, GitBranch, House } from 'lucide-react';
import { Fragment } from 'react';
import type { BranchInfo } from '@shared/domain/branch';
import { shortBranchName, spec } from '@shared/domain/specs';
import { usePlace, useWorkspaceInfo } from '../../app/workspace/useWorkspace';
import { commentDraftKey, DetailsHeading } from '../../components/DetailsHeading';
import { placeId } from '@shared/domain/place';
import { PLAIN_LINKS, type ObjectLinks } from '../../components/objectLinks';
import { branchWorkedOn } from '../../components/workingObject';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsBadge } from '../../ui/DetailsBadge';
import { DetailsPanel } from '../../ui/DetailsPanel';
import type { Property } from '../../ui/PropertyList';
import { AttributesDetailsSection } from '../attributes/AttributesDetailsSection';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { openReview } from '../codeReviews/codeReviewOperations';
import { asMergeRequest } from '../codeReviews/mergeRequestState';
import { useBranchReview } from '../codeReviews/useBranchReviews';
import { useSettled } from '../../lib/useSettled';
import { MergeRequestSummaryCard } from '../codeReviews/MergeRequestSummaryCard';
import { DetailsSection } from '../../ui/DetailsSection';
import { BranchChip } from './BranchChip';
import { diffBranch, saveBranchComment } from './branchOperations';

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
  const place = usePlace();
  // The review its chip shows, read with the branches in view (`useBranchReview`): a merge request gets a section.
  const request = asMergeRequest(useBranchReview(branch.id, useSettled()) ?? undefined);
  const isCurrent = branchWorkedOn(workspace?.selector) === branch.name;
  const saveComment = (comment: string) => saveBranchComment(place, branch, comment);

  return (
    <DetailsPanel
      icon={<GitBranch />}
      kind="Branch"
      heading={<DetailsHeading name={shortBranchName(branch.name)} comment={branch.comment} onSave={saveComment} draftKey={commentDraftKey(placeId(place), 'branch', branch.id)} />}
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
    >
      {request && (
        <DetailsSection title="Merge request">
          <MergeRequestSummaryCard request={request} onOpen={() => openReview(request)} />
        </DetailsSection>
      )}
      <AttributesDetailsSection objectSpec={spec.branch(branch.name)} />
    </DetailsPanel>
  );
}
