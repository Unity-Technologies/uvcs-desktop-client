import { Download, X } from 'lucide-react';
import { APP_NAME } from '../../lib/appIdentity';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { SWEEP, type ProgressBarState } from '../operations/progressBar';
import { ProgressTrack } from '../operations/ProgressTrack';
import { installLabel, updateCardOf } from './updateCardStatus';
import { installUpdate, putOffUpdate, useUpdateStore } from './updateStore';
import styles from './UpdateCard.module.css';

/** How long the bar takes to glide to each new percent. */
const GLIDE_MS = 300;

/** The corner card of an update downloading, then ready to install until put off (`updateCardOf`). */
export function UpdateCard() {
  const card = useUpdateStore((state) => updateCardOf(state.status, state.dismissedVersion));
  if (!card) return null;

  if (card.state === 'downloading') {
    const bar: ProgressBarState = card.percent > 0 ? { mode: 'fill', value: card.percent / 100, durationMs: GLIDE_MS, remaining: null, motion: null } : SWEEP;
    return (
      <div className={styles.card} role="status">
        <div className={styles.row}>
          <Download size={15} className={styles.icon} />
          <span className={styles.title}>Downloading version {card.version}…</span>
          <span className={styles.percent}>{card.percent}%</span>
        </div>
        <ProgressTrack bar={bar} />
      </div>
    );
  }

  const byInstaller = card.install === 'installer';
  return (
    <div className={styles.card} role="alert">
      <div className={styles.row}>
        <Download size={15} className={styles.icon} />
        <span className={styles.title}>
          {APP_NAME} {card.version} {byInstaller ? 'has been downloaded.' : 'is ready to install.'}
        </span>
        <IconButton icon={<X size={13} />} label="Later" size="small" onClick={putOffUpdate} />
      </div>
      {/* A Mac build without a Developer ID signature can't replace itself: the user drags the new one in. */}
      {byInstaller && <p className={styles.hint}>Open the installer and drag {APP_NAME} to your Applications folder to finish.</p>}
      <div className={styles.actions}>
        <Button variant="ghost" size="small" onClick={putOffUpdate}>
          Later
        </Button>
        <Button variant="primary" size="small" onClick={() => void installUpdate()}>
          {installLabel(card.install)}
        </Button>
      </div>
    </div>
  );
}
