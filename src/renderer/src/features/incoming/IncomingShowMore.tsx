import { INCOMING_CHANGESETS_PAGE } from '@shared/domain/incoming';
import { Spinner } from '../../ui/Spinner';
import styles from './IncomingShowMore.module.css';

interface IncomingShowMoreProps {
  loading: boolean;
  onShowMore: () => void;
}

/** The end of the incoming changesets read so far, while older ones remain: reads the next page (`useIncomingChangesetList`). */
export function IncomingShowMore({ loading, onShowMore }: IncomingShowMoreProps) {
  return (
    <button type="button" className={styles.showMore} disabled={loading} onClick={onShowMore}>
      {loading && <Spinner size={12} />}
      Show {INCOMING_CHANGESETS_PAGE} more
    </button>
  );
}
