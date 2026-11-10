import { ExternalLink } from 'lucide-react';
import { api } from '../../../api/client';
import { Button } from '../../../ui/Button';
import type { FailureWords } from './connectFlow';
import styles from './IssueTrackerPane.module.css';

/**
 * A failed sign-in or Connect in plain words (`connectFailureWords`), with the GitHub App's install page beside them
 * when installing it may be all that's missing (`installPage`).
 */
export function SignInProblem({ failed }: { failed: FailureWords }) {
  const { installPage } = failed;
  return (
    <div className={styles.row} role="alert">
      <p className={styles.problem}>{failed.words}</p>
      {installPage && (
        <Button size="small" variant="ghost" icon={<ExternalLink size={13} />} onClick={() => void api.system.openExternal(installPage)}>
          Install on GitHub
        </Button>
      )}
    </div>
  );
}
