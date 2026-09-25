import { FileDiff, GitBranch, GitMerge } from 'lucide-react';
import { spec } from '@shared/domain/specs';
import { UserLabel } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { RelativeTime } from '../../../ui/RelativeTime';
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
  const loadedChangesets = layout.nodesByColumn.filter((node) => node.changeset.branch === branch.name).length;

  return (
    <div className={styles.details}>
      <div>
        <div className={styles.kicker}>Branch</div>
        <h2 className={styles.title}>
          <BranchName name={branch.name} />
        </h2>
      </div>

      {branch.comment ? <p className={`${styles.comment} selectable`}>{branch.comment}</p> : <p className={styles.noComment}>No comment</p>}

      <div className={styles.actions}>
        <Button size="small" icon={<GitBranch size={13} />} onClick={() => graphActions.switchToBranch(workspacePath, branch.name)}>
          Switch
        </Button>
        <Button size="small" icon={<GitMerge size={13} />} onClick={() => graphActions.merge('merge', spec.branch(branch.name))}>
          Merge from
        </Button>
        <Button size="small" icon={<FileDiff size={13} />} onClick={() => graphActions.diffBranch(branch.name)}>
          Diff
        </Button>
      </div>

      <dl className={styles.facts}>
        {branch.parent && (
          <>
            <dt>Parent</dt>
            <dd>
              <BranchName name={branch.parent} onClick={() => selectBranch(branch.parent)} />
            </dd>
          </>
        )}
        <dt>Created by</dt>
        <dd>
          <UserLabel user={branch.owner} />
        </dd>
        <dt>Created</dt>
        <dd>
          <RelativeTime date={branch.date} />
        </dd>
        <dt>Head</dt>
        <dd>
          {layout.nodes.has(branch.headChangeset) ? (
            <button className={styles.link} onClick={() => goToChangeset(branch.headChangeset)}>
              Changeset {branch.headChangeset}
            </button>
          ) : (
            `Changeset ${branch.headChangeset}`
          )}
        </dd>
        <dt>In view</dt>
        <dd>
          {loadedChangesets} {loadedChangesets === 1 ? 'changeset' : 'changesets'}
        </dd>
      </dl>
    </div>
  );
}
