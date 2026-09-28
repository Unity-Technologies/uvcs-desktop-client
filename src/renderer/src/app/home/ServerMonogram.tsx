import { stableHue } from '../../lib/stableHue';
import { TintedMark } from '../../ui/TintedMark';
import { serverInitials } from './serverInitials';
import styles from './Home.module.css';

/** A server in the folded sidebar: its initials on its own stable color, where a cloud icon would look like every other. */
export function ServerMonogram({ label }: { label: string }) {
  return (
    <TintedMark hue={stableHue(label)} size={20} className={styles.serverMonogram}>
      {serverInitials(label)}
    </TintedMark>
  );
}
