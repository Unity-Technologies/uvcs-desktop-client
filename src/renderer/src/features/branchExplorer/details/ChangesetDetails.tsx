import { FileDiff, GitCommitVertical, GitMerge, Home, Tag } from 'lucide-react';
import { spec } from '@shared/domain/specs';
import { PathLabel } from '../../../components/PathLabel';
import { Button } from '../../../ui/Button';
import { DetailsBadge, DetailsPanel, DetailsSection, DetailsText } from '../../../ui/DetailsPanel';
import { PropertyList, type Property } from '../../../ui/PropertyList';
import { ChangedFilesSection } from '../../changesets/ChangedFilesSection';
import { graphActions } from '../graphActions';
import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import { MERGE_LINK_NAMES } from '../model/mergeLinkNames';
import { BranchName } from './BranchName';
import styles from './DetailsPanel.module.css';

interface ChangesetDetailsProps {
  node: NodeLayout;
  layout: GraphLayout;
  workspacePath: string;
  isHome: boolean;
  goToChangeset: (id: number) => void;
  selectBranch: (name: string) => void;
}

export function ChangesetDetails({ node, layout, workspacePath, isHome, goToChangeset, selectBranch }: ChangesetDetailsProps) {
  const { changeset } = node;
  const labels = layout.labelsByChangeset.get(changeset.id) ?? [];
  const link = (id: number) => <ChangesetLink id={id} goToChangeset={goToChangeset} />;

  const properties: Property[] = [
    { label: 'Branch', value: <BranchName name={changeset.branch} onClick={() => selectBranch(changeset.branch)} /> },
    { label: 'Parent', value: layout.nodes.has(changeset.parent) ? link(changeset.parent) : '' },
    ...layout.mergeLinks
      .filter((merge) => merge.destinationChangeset === changeset.id)
      .map((merge) => ({ label: `${MERGE_LINK_NAMES[merge.type]} from`, value: link(merge.sourceChangeset) })),
    ...layout.mergeLinks
      .filter((merge) => merge.sourceChangeset === changeset.id)
      .map((merge) => ({ label: 'Merged into', value: link(merge.destinationChangeset) })),
  ];

  return (
    <DetailsPanel
      icon={<GitCommitVertical />}
      kind={`Changeset ${changeset.id}`}
      context={<PathLabel path={changeset.branch} />}
      title={changeset.comment.split('\n')[0] || 'No comment'}
      author={{ user: changeset.owner, date: changeset.date }}
      badges={
        <>
          {isHome && (
            <DetailsBadge tone="success">
              <Home size={10} />
              Workspace
            </DetailsBadge>
          )}
          {labels.map((label) => (
            <DetailsBadge key={label.name} tone="warning">
              <Tag size={10} />
              {label.name}
            </DetailsBadge>
          ))}
        </>
      }
      actions={
        <>
          <Button variant="primary" icon={<FileDiff size={14} />} onClick={() => graphActions.diffChangeset(changeset.id)}>
            Diff
          </Button>
          <Button icon={<GitCommitVertical size={14} />} onClick={() => graphActions.switchToChangeset(workspacePath, changeset.id)}>
            Switch
          </Button>
          <Button icon={<GitMerge size={14} />} onClick={() => graphActions.merge('merge', spec.changeset(changeset.id))}>
            Merge
          </Button>
        </>
      }
    >
      {changeset.comment.includes('\n') && (
        <DetailsSection title="Comment">
          <DetailsText text={changeset.comment} placeholder="No comment" />
        </DetailsSection>
      )}
      <DetailsSection title="Relations">
        <PropertyList properties={properties} />
      </DetailsSection>
      <ChangedFilesSection target={{ kind: 'changeset', changesetId: changeset.id }} onOpen={(path) => graphActions.diffChangeset(changeset.id, path)} />
    </DetailsPanel>
  );
}

function ChangesetLink({ id, goToChangeset }: { id: number; goToChangeset: (id: number) => void }) {
  return (
    <button className={styles.link} onClick={() => goToChangeset(id)}>
      Changeset {id}
    </button>
  );
}
