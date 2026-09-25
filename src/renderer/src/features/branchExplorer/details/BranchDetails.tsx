import { FileDiff, GitBranch, GitMerge } from 'lucide-react';
import { spec } from '@shared/domain/specs';
import { PathLabel } from '../../../components/PathLabel';
import { pluralize } from '../../../lib/text';
import { Button } from '../../../ui/Button';
import { DetailsPanel, DetailsSection, DetailsText } from '../../../ui/DetailsPanel';
import { PropertyList } from '../../../ui/PropertyList';
import { ChangedFilesSection } from '../../changesets/ChangedFilesSection';
import { graphActions } from '../graphActions';
import type { GraphLayout, Lane } from '../model/layoutGraph';
import { BranchName } from './BranchName';
import styles from './DetailsPanel.module.css';

interface BranchDetailsProps {
  lane: Lane;
  layout: GraphLayout;
  workspacePath: string;
  goToChangeset: (id: number) => void;
  selectBranch: (name: string) => void;
}

export function BranchDetails({ lane, layout, workspacePath, goToChangeset, selectBranch }: BranchDetailsProps) {
  const { branch } = lane;
  const changesetsInView = layout.nodesByColumn.filter((node) => node.changeset.branch === branch.name).length;

  return (
    <DetailsPanel
      icon={<GitBranch />}
      kind="Branch"
      context={branch.parent && <PathLabel path={branch.parent} />}
      title={<BranchName name={branch.name} short />}
      author={{ user: branch.owner, date: branch.date }}
      actions={
        <>
          <Button variant="primary" icon={<GitBranch size={14} />} onClick={() => graphActions.switchToBranch(workspacePath, branch.name)}>
            Switch
          </Button>
          <Button icon={<GitMerge size={14} />} onClick={() => graphActions.merge('merge', spec.branch(branch.name))}>
            Merge
          </Button>
          <Button icon={<FileDiff size={14} />} onClick={() => graphActions.diffBranch(branch.name)}>
            Changes
          </Button>
        </>
      }
    >
      <DetailsSection title="Comment">
        <DetailsText text={branch.comment} placeholder="No comment" />
      </DetailsSection>
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Parent', value: branch.parent && <BranchName name={branch.parent} onClick={() => selectBranch(branch.parent)} /> },
            {
              label: 'Head',
              value: layout.nodes.has(branch.headChangeset) ? (
                <button className={styles.link} onClick={() => goToChangeset(branch.headChangeset)}>
                  Changeset {branch.headChangeset}
                </button>
              ) : (
                `Changeset ${branch.headChangeset}`
              ),
            },
            { label: 'In view', value: pluralize(changesetsInView, 'changeset') },
            { label: 'Full name', value: branch.name, mono: true, copyText: branch.name },
          ]}
        />
      </DetailsSection>
      <ChangedFilesSection target={{ kind: 'branch', branch: branch.name }} onOpen={(path) => graphActions.diffBranch(branch.name, path)} />
    </DetailsPanel>
  );
}
