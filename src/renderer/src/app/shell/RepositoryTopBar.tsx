import { FolderPlus } from 'lucide-react';
import { Button } from '../../ui/Button';
import { AccountButton } from '../account/AccountButton';
import { createWorkspaceOfExplored } from '../workspace/createWorkspaceOfExplored';
import { useSession } from '../workspace/sessionStore';
import { TopBar } from './TopBar';
import { TopBarSearch } from './TopBarSearch';

/**
 * The top bar of a repository explored without a workspace: the search, the way to make it a workspace without
 * leaving it ("Create workspace"), and the account.
 */
export function RepositoryTopBar({ repository }: { repository: string }) {
  const goHome = useSession((state) => state.goHome);

  const end = (
    <>
      <TopBarSearch tip="Fuzzy search branches, labels, changesets, shelves, code reviews and commands" />
      <Button
        variant="primary"
        icon={<FolderPlus size={14} />}
        data-tip="Download the repository to a folder on this computer and work in it, right here"
        onClick={() => createWorkspaceOfExplored(repository)}
      >
        Create workspace
      </Button>
      <AccountButton />
    </>
  );

  return <TopBar onHome={goHome} end={end} />;
}
