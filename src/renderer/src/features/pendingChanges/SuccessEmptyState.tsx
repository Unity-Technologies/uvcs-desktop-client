import { CheckCircle2, Link } from 'lucide-react';
import type { ReactNode } from 'react';
import { spec } from '@shared/domain/specs';
import { navigation } from '../../app/navigation/navigationStore';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { changesetLink } from '../../lib/plasticLink';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import type { SuccessMoment } from './successMoment';
import styles from './SuccessEmptyState.module.css';

interface SuccessEmptyStateProps {
  moment: SuccessMoment;
  repositoryName: string;
  server: string;
  /** What the usual empty state offers next (finishing the task), under the moment's own action. */
  suggestion?: ReactNode;
}

/**
 * Changes' empty state after a check-in or an update, until the next change: "Checked in cs:4", the changeset a link to
 * its diff (the range an update brought), the summary under it, and a link to share.
 */
export function SuccessEmptyState({ moment, repositoryName, server, suggestion }: SuccessEmptyStateProps) {
  const { verb, changesetId, fromChangeset, detail } = moment;
  const range = fromChangeset !== undefined && changesetId - fromChangeset > 1;
  const view = (): void =>
    navigation.openPage(
      range
        ? { kind: 'diff', title: `Changesets ${fromChangeset + 1} to ${changesetId}`, target: { kind: 'range', fromSpec: spec.changeset(fromChangeset), toSpec: spec.changeset(changesetId) } }
        : { kind: 'diff', title: `Changeset ${changesetId}`, target: { kind: 'changeset', changesetId } },
    );
  const link = changesetLink(repositoryName, server, changesetId, range ? fromChangeset : undefined);

  return (
    <div className={styles.moment} role="status">
      <EmptyState
        icon={<CheckCircle2 size={24} />}
        tone="success"
        title={
          <>
            {verb}{' '}
            <button type="button" className={styles.changeset} onClick={view} data-tip={range ? `View changesets ${fromChangeset + 1} to ${changesetId}` : `View changeset ${changesetId}`}>
              cs:{changesetId}
            </button>
          </>
        }
        description={detail}
        action={
          <div className={styles.actions}>
            <Button icon={<Link size={13} />} onClick={() => copyToClipboard(link, 'Link')} data-tip={link}>
              Copy link
            </Button>
            {suggestion}
          </div>
        }
      />
    </div>
  );
}
