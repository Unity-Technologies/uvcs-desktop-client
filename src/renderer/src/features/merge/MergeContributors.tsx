import * as Popover from '@radix-ui/react-popover';
import { ArrowRight } from 'lucide-react';
import type { MergeContributor, MergeContributors as Contributors } from '@shared/domain/merge';
import { shortBranchName } from '@shared/domain/specs';
import { PathLabel } from '../../components/PathLabel';
import type { MergeLabels } from './mergeDescription';
import styles from './MergeContributors.module.css';

interface MergeContributorsProps {
  contributors: Contributors;
  labels: MergeLabels;
}

/** The changesets the merge combines, "cs:239 → cs:240" next to the title; clicking lists them with the base. */
export function MergeContributors({ contributors, labels }: MergeContributorsProps) {
  const { source, destination } = labels.roles;
  const rows: { role: string; contributor: MergeContributor; name?: string; tip?: string }[] = [
    ...(contributors.base ? [{ role: 'Base', contributor: contributors.base, tip: 'Common ancestor' }] : []),
    { role: source.name, contributor: contributors.source, name: labels.source },
    { role: destination.name, contributor: contributors.destination },
  ];

  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger} aria-label="Changesets in this merge" data-tip="Changesets in this merge">
        {shortName(contributors.source, labels.source)}
        <ArrowRight size={11} className={styles.arrow} />
        {shortName(contributors.destination, labels.destination)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.card} align="end" sideOffset={6}>
          <dl className={styles.grid}>
            {rows.map(({ role, contributor, name, tip }) => (
              <div key={role} className={styles.row}>
                <dt className={styles.role} data-tip={tip}>
                  {role}
                </dt>
                <dd className={styles.changeset}>{contributor.changesetId >= 0 ? `cs:${contributor.changesetId}` : ''}</dd>
                <dd className={styles.branch}>{(contributor.branch || name) && <PathLabel path={contributor.branch || name!} />}</dd>
              </div>
            ))}
          </dl>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** `cs:12`; a shelve has no changeset of its own (cm reports a negative one), so its name instead. */
function shortName(contributor: MergeContributor, name: string): string {
  return contributor.changesetId >= 0 ? `cs:${contributor.changesetId}` : shortBranchName(contributor.branch || name);
}
