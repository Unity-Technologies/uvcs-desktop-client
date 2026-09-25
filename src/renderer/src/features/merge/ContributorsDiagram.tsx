import { ArrowRight } from 'lucide-react';
import type { MergeContributor, MergeContributors } from '@shared/domain/merge';
import { PathLabel } from '../../components/PathLabel';
import type { MergeLabels } from './mergeDescription';
import styles from './ContributorsDiagram.module.css';

interface ContributorsDiagramProps {
  contributors: MergeContributors;
  labels: MergeLabels;
  intoServerBranch: boolean;
}

/** Where the merge starts from (the base, the common ancestor) and the two versions it combines into the result. */
export function ContributorsDiagram({ contributors, labels, intoServerBranch }: ContributorsDiagramProps) {
  const { source, destination } = labels.roles;
  return (
    <div className={styles.diagram} aria-label="What this merge combines">
      {contributors.base && (
        <>
          <Node
            role="Base"
            contributor={contributors.base}
            tone="base"
            explanation={`Base: the common ancestor of both sides${where(contributors.base)}. Each side's changes are measured from it.`}
          />
          <ArrowRight size={13} className={styles.arrow} />
        </>
      )}
      <div className={styles.pair}>
        <Node
          role={source.name}
          contributor={contributors.source}
          tone="source"
          name={labels.source}
          explanation={`${source.name}: what you merge from${where(contributors.source, labels.source)} (the merge source).`}
        />
        <Node
          role={destination.name}
          contributor={contributors.destination}
          tone="destination"
          explanation={
            intoServerBranch
              ? `${destination.name}: the branch you merge into${where(contributors.destination)}.`
              : `${destination.name}: what your workspace has now${where(contributors.destination)} (the merge destination).`
          }
        />
      </div>
      <ArrowRight size={13} className={styles.arrow} />
      <span
        className={styles.result}
        data-tip={
          intoServerBranch
            ? `Result: the new changeset on ${labels.destination}. Nothing is created until you merge.`
            : 'Result: what your workspace will have after the merge, as pending changes to check in. Nothing is written until you complete the merge.'
        }
      >
        Result
      </span>
    </div>
  );
}

/** ", cs:12 on /main"; a shelve has no changeset of its own (cm reports a negative one) nor a branch. */
function where(contributor: MergeContributor, name?: string): string {
  const branch = contributor.branch || name;
  const changeset = contributor.changesetId >= 0 ? `cs:${contributor.changesetId}` : '';
  if (changeset && branch) return `, ${changeset} on ${branch}`;
  return changeset || branch ? `, ${changeset || branch}` : '';
}

interface NodeProps {
  role: string;
  contributor: MergeContributor;
  tone: 'base' | 'source' | 'destination';
  explanation: string;
  /** Shown when the contributor has no branch (a shelve). */
  name?: string;
}

function Node({ role, contributor, tone, explanation, name }: NodeProps) {
  const label = contributor.branch || name;
  return (
    <span className={styles.node} data-tone={tone} data-tip={explanation}>
      <span className={styles.dot} />
      <span className={styles.role}>{role}</span>
      {contributor.changesetId >= 0 && <span className={styles.changeset}>cs:{contributor.changesetId}</span>}
      {label && (
        <span className={styles.branch}>
          <PathLabel path={label} fitContent tooltip={false} />
        </span>
      )}
    </span>
  );
}
