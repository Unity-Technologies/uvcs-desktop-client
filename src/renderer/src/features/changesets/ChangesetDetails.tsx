import { FileDiff, GitCommitVertical, Home, Tag } from 'lucide-react';
import type { Changeset } from '@shared/domain/changeset';
import { spec } from '@shared/domain/specs';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { PLAIN_LINKS, type ObjectLinks } from '../../components/objectLinks';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { firstLine } from '../../lib/text';
import { Button } from '../../ui/Button';
import { DetailsComment } from '../../ui/DetailsComment';
import { DetailsBadge, DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList, type Property } from '../../ui/PropertyList';
import { AttributesEditor } from '../attributes/AttributesEditor';
import { useLabels } from '../labels/useLabels';
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
  const { data: labels } = useLabels();
  const changesetLabels = labels?.filter((label) => label.changeset === changeset.id) ?? [];
  const workspacePath = useWorkspacePath();

  return (
    <DetailsPanel
      icon={<GitCommitVertical />}
      kind={`Changeset ${changeset.id}`}
      context={changeset.branch}
      title={firstLine(changeset.comment) || 'No comment'}
      author={{ user: changeset.owner, date: changeset.date }}
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
      primaryAction={
        <Button variant="primary" icon={<FileDiff size={14} />} onClick={() => openChangesetDiff(changeset)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
    >
      <DetailsComment text={changeset.comment} onSave={(comment) => saveChangesetComment(workspacePath, changeset, comment)} />
      <ChangedFilesSection target={{ kind: 'changeset', changesetId: changeset.id }} onOpen={(path) => openChangesetDiff(changeset, path)} />
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Created', value: formatDateTime(changeset.date) },
            { label: 'Branch', value: links.branch(changeset.branch) },
            { label: 'Parent', value: changeset.parent >= 0 ? links.changeset(changeset.parent) : '', copyText: spec.changeset(changeset.parent) },
            { label: 'Repository', value: changeset.repository },
            { label: 'GUID', value: changeset.guid, mono: true, copyText: changeset.guid },
          ]}
        />
      </DetailsSection>
      <AttributesEditor key={changeset.id} objectSpec={spec.changeset(changeset.id)} />
      {relations.length > 0 && (
        <DetailsSection title="Relations">
          <PropertyList properties={relations} />
        </DetailsSection>
      )}
    </DetailsPanel>
  );
}
