import { FileDiff, GitCommitVertical, GitMerge } from 'lucide-react';
import { spec } from '@shared/domain/specs';
import { UserLabel } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { RelativeTime } from '../../../ui/RelativeTime';
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
  const mergedFrom = layout.mergeLinks.filter((link) => link.destinationChangeset === changeset.id);
  const mergedTo = layout.mergeLinks.filter((link) => link.sourceChangeset === changeset.id);

  return (
    <div className={styles.details}>
      <div>
        <div className={styles.kicker}>Changeset</div>
        <h2 className={styles.title}>
          {changeset.id}
          {isHome && <span className={styles.home}>Workspace is here</span>}
        </h2>
      </div>

      {changeset.comment ? (
        <p className={`${styles.comment} selectable`}>{changeset.comment}</p>
      ) : (
        <p className={styles.noComment}>No comment</p>
      )}

      <div className={styles.actions}>
        <Button size="small" icon={<FileDiff size={13} />} onClick={() => graphActions.diffChangeset(changeset.id)}>
          Diff
        </Button>
        <Button size="small" icon={<GitCommitVertical size={13} />} onClick={() => graphActions.switchToChangeset(workspacePath, changeset.id)}>
          Switch here
        </Button>
        <Button size="small" icon={<GitMerge size={13} />} onClick={() => graphActions.merge('merge', spec.changeset(changeset.id))}>
          Merge from
        </Button>
      </div>

      <dl className={styles.facts}>
        <dt>Branch</dt>
        <dd>
          <BranchName name={changeset.branch} onClick={() => selectBranch(changeset.branch)} />
        </dd>
        <dt>Author</dt>
        <dd>
          <UserLabel user={changeset.owner} />
        </dd>
        <dt>Date</dt>
        <dd>
          <RelativeTime date={changeset.date} />
        </dd>
        {layout.nodes.has(changeset.parent) && (
          <>
            <dt>Parent</dt>
            <dd>
              <ChangesetLink id={changeset.parent} goToChangeset={goToChangeset} />
            </dd>
          </>
        )}
        {labels.length > 0 && (
          <>
            <dt>Labels</dt>
            <dd>
              {labels.map((label) => (
                <span key={label.name} className={styles.chip}>
                  {label.name}
                </span>
              ))}
            </dd>
          </>
        )}
        {mergedFrom.map((link) => (
          <MergeFact key={`from-${link.sourceChangeset}`} term={`${MERGE_LINK_NAMES[link.type]} from`} id={link.sourceChangeset} goToChangeset={goToChangeset} />
        ))}
        {mergedTo.map((link) => (
          <MergeFact key={`to-${link.destinationChangeset}`} term="Merged into" id={link.destinationChangeset} goToChangeset={goToChangeset} />
        ))}
      </dl>
    </div>
  );
}

function MergeFact({ term, id, goToChangeset }: { term: string; id: number; goToChangeset: (id: number) => void }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>
        <ChangesetLink id={id} goToChangeset={goToChangeset} />
      </dd>
    </>
  );
}

function ChangesetLink({ id, goToChangeset }: { id: number; goToChangeset: (id: number) => void }) {
  return (
    <button className={styles.link} onClick={() => goToChangeset(id)}>
      Changeset {id}
    </button>
  );
}
