import { WorkingObjectButton } from '../../features/branches/WorkingObjectButton';
import { IncomingChip } from '../../features/incoming/IncomingChip';
import { AccountButton } from '../account/AccountButton';
import { useSession } from '../workspace/sessionStore';
import { TopBar } from './TopBar';
import { TopBarSearch } from './TopBarSearch';
import styles from './WorkspaceTopBar.module.css';

/** A workspace's top bar: its branch (and what's incoming) after the home button, the search and the account at the end. */
export function WorkspaceTopBar() {
  const goHome = useSession((state) => state.goHome);

  const end = (
    <>
      <TopBarSearch tip="Fuzzy search files, branches, labels, changesets, shelves, code reviews and commands" />
      <AccountButton />
    </>
  );

  return (
    <TopBar onHome={goHome} end={end}>
      <div className={styles.branchControls}>
        <WorkingObjectButton />
        <IncomingChip />
      </div>
    </TopBar>
  );
}
