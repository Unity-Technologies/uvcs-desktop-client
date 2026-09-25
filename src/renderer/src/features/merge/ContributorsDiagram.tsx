import { ArrowRight } from 'lucide-react';
import type { MergeContributor, MergeContributors } from '@shared/domain/merge';
import styles from './ContributorsDiagram.module.css';

/** Where the merge starts from (the common ancestor) and the two versions it combines. */
export function ContributorsDiagram({ contributors, sourceName }: { contributors: MergeContributors; sourceName: string }) {
  return (
    <div className={styles.diagram} aria-label="Merge contributors">
      {contributors.base && (
        <>
          <Node role="Ancestor" contributor={contributors.base} tone="base" />
          <ArrowRight size={13} className={styles.arrow} />
        </>
      )}
      <div className={styles.pair}>
        <Node role="Source" contributor={contributors.source} tone="source" name={sourceName} />
        <Node role="Destination" contributor={contributors.destination} tone="destination" />
      </div>
      <ArrowRight size={13} className={styles.arrow} />
      <span className={styles.result}>Result</span>
    </div>
  );
}

interface NodeProps {
  role: string;
  contributor: MergeContributor;
  tone: string;
  /** Shown when the contributor has no branch (a shelve). */
  name?: string;
}

function Node({ role, contributor, tone, name }: NodeProps) {
  const label = contributor.branch || name;
  return (
    <span className={styles.node} data-tone={tone} data-tip={`${role}: ${label}`}>
      <span className={styles.dot} />
      <span className={styles.role}>{role}</span>
      {/* A shelve has no changeset of its own (cm reports a negative one) nor a branch. */}
      {contributor.changesetId >= 0 && <span className={styles.changeset}>{contributor.changesetId}</span>}
      {label && <span className={styles.branch}>{label}</span>}
    </span>
  );
}
