import type { MouseEvent } from 'react';
import { INCOMING_CHANGESETS_PAGE } from '@shared/domain/incoming';
import { Spinner } from '../../ui/Spinner';
import styles from './IncomingShowMore.module.css';

interface IncomingShowMoreProps {
  loading: boolean;
  /** `fromKeyboard`: pressed with Enter or Space, so the list goes on from the page read. */
  onShowMore: (fromKeyboard: boolean) => void;
}

/**
 * The end of the incoming changesets read so far, while older ones remain: reads the next page
 * (`useIncomingChangesetList`). While it reads, it stays focusable (`aria-disabled`, not `disabled`, which would drop
 * the keyboard's focus) and ignores presses.
 */
export function IncomingShowMore({ loading, onShowMore }: IncomingShowMoreProps) {
  const press = (event: MouseEvent): void => {
    // A key press reaches a button as a click with no pointer: `detail` counts pointer clicks.
    if (!loading) onShowMore(event.detail === 0);
  };
  return (
    <button type="button" className={styles.showMore} aria-disabled={loading} onClick={press}>
      {loading && <Spinner size={12} />}
      Show {INCOMING_CHANGESETS_PAGE} more
    </button>
  );
}
