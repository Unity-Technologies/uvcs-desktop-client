import { FileDiff, GitCommitVertical, Home, Tag } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { spec } from '@shared/domain/specs';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { DetailsHeading } from '../../components/DetailsHeading';
import { PLAIN_LINKS, type ObjectLinks } from '../../components/objectLinks';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsBadge, DetailsCopyable, DetailsPanel } from '../../ui/DetailsPanel';
import type { Property } from '../../ui/PropertyList';
import { AttributeChips } from '../attributes/AttributeChips';
import { BranchChip } from '../branches/BranchChip';
import { useLabelsByChangeset } from '../labels/useLabelsByChangeset';
import { ChangedFilesSection } from './ChangedFilesSection';
import { openChangesetDiff, saveChangesetComment } from './changesetOperations';

/** A changeset as lists and the Branch Explorer know it; the graph doesn't read the GUID and repository. */
export type ChangesetInfo = Omit<Changeset, 'guid' | 'repository'> & Partial<Pick<Changeset, 'guid' | 'repository'>>;

interface ChangesetDetailsProps {
  changeset: ChangesetInfo;
  /** The changeset's context menu, offered behind "More actions". */
  menu: MenuEntry[];
  links?: ObjectLinks;
  /** Merges from and into it, where the view knows them. */
  relations?: Property[];
}

export function ChangesetDetails({ changeset, menu, links = PLAIN_LINKS, relations = [] }: ChangesetDetailsProps) {
  const { data: workspace } = useWorkspaceInfo();
  const changesetLabels = useLabelsByChangeset().get(changeset.id) ?? [];
  const workspacePath = useWorkspacePath();

  return (
    <DetailsPanel
      icon={<GitCommitVertical />}
      kind="Changeset"
      heading={<DetailsHeading comment={changeset.comment} onSave={(comment) => saveChangesetComment(workspacePath, changeset, comment)} />}
      author={{ user: changeset.owner, date: changeset.date }}
      meta={[
        <DetailsCopyable key="id" text={spec.changeset(changeset.id)} what="Changeset spec" />,
        <BranchChip key="branch" name={changeset.branch} onSelect={links.selectBranch} />,
      ]}
      badges={
        <>
          {changeset.id === workspace?.loadedChangeset && (
            <DetailsBadge tone="success">
              <Home size={10} />
              Workspace
            </DetailsBadge>
          )}
          {changesetLabels.map((label) => (
            <DetailsBadge key={label.id} tone="warning">
              <Tag size={10} />
              {label.name}
            </DetailsBadge>
          ))}
        </>
      }
      attributes={<AttributeChips key={changeset.id} objectSpec={spec.changeset(changeset.id)} />}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => openChangesetDiff(changeset)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
      properties={[
        { label: 'Created', value: formatDateTime(changeset.date) },
        { label: 'Branch', value: links.branch(changeset.branch) },
        { label: 'Parent', value: changeset.parent >= 0 ? links.changeset(changeset.parent) : '', copyText: spec.changeset(changeset.parent) },
        { label: 'Repository', value: changeset.repository },
        { label: 'GUID', value: changeset.guid, mono: true, copyText: changeset.guid },
        ...relations,
      ]}
      changes={<ChangedFilesSection target={{ kind: 'changeset', changesetId: changeset.id }} onOpen={(path) => openChangesetDiff(changeset, path)} />}
    />
  );
}
