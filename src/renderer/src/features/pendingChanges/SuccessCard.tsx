import { Eye, Link } from 'lucide-react';
import { useEffect, useState } from 'react';
import { spec } from '@shared/domain/specs';
import { navigation } from '../../app/navigation/navigationStore';
import { copyToClipboard } from '../../lib/copyToClipboard';
import { changesetLink } from '../../lib/plasticLink';
import { Button } from '../../ui/Button';
import { successMomentLeft, type SuccessMoment } from './successMoment';
import styles from './SuccessCard.module.css';

/** How long the card takes to fade into the usual empty state, as in the stylesheet. */
const FADE_MS = 400;

interface SuccessCardProps {
  moment: SuccessMoment;
  repositoryName: string;
  server: string;
  /** The moment is over: the empty state takes its place. */
  onDone: () => void;
}

/** In the Changes empty state, for a few seconds after a check-in or an update: what landed, a way to see it and a link to share. */
export function SuccessCard({ moment, repositoryName, server, onDone }: SuccessCardProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const left = successMomentLeft(moment, Date.now());
    const fade = setTimeout(() => setLeaving(true), Math.max(0, left - FADE_MS));
    const done = setTimeout(onDone, left);
    return () => {
      clearTimeout(fade);
      clearTimeout(done);
    };
  }, [moment.at]);

  const { verb, changesetId, branch, fromChangeset, detail } = moment;
  const range = fromChangeset !== undefined && changesetId - fromChangeset > 1;
  const view = (): void =>
    navigation.openPage(
      range
        ? { kind: 'diff', title: `Changesets ${fromChangeset + 1} to ${changesetId}`, target: { kind: 'range', fromSpec: spec.changeset(fromChangeset), toSpec: spec.changeset(changesetId) } }
        : { kind: 'diff', title: `Changeset ${changesetId}`, target: { kind: 'changeset', changesetId } },
    );
  const link = changesetLink(repositoryName, server, changesetId, range ? fromChangeset : undefined);

  return (
    <div className={styles.moment} data-leaving={leaving}>
      <div className={styles.card} role="status">
        <svg className={styles.check} viewBox="0 0 36 36" aria-hidden>
          <circle className={styles.ring} cx="18" cy="18" r="16" />
          <path className={styles.tick} d="M11 18.5l4.5 4.5L25 13.5" />
        </svg>
        <div className={styles.title}>
          {verb} cs:{changesetId} <span className={styles.branch}>on {branch}</span>
        </div>
        {detail && <div className={styles.detail}>{detail}</div>}
        <div className={styles.actions}>
          <Button size="small" icon={<Eye size={13} />} onClick={view}>
            {range ? 'View changes' : 'View changeset'}
          </Button>
          <Button size="small" icon={<Link size={13} />} onClick={() => copyToClipboard(link, 'Link')} data-tip={link}>
            Copy link
          </Button>
        </div>
      </div>
    </div>
  );
}
