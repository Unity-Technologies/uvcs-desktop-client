import { useQueryClient } from '@tanstack/react-query';
import { House, KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { SignInProblem } from '@shared/domain/signIn';
import { Button } from '../../ui/Button';
import { openDialog } from '../../ui/dialog/dialogStore';
import { ScreenMessage } from '../../ui/ScreenMessage';
import { ConnectionProblemDialog } from '../startup/ConnectionProblemDialog';
import { useSession } from '../workspace/sessionStore';
import { signInWords } from './signInWords';
import { checkSessionNow } from './useSessionCheck';

interface SignInScreenProps {
  problem: SignInProblem;
  /** Under the place's top bar (`SignInCover`); false where it takes the window's place, as a workspace that can't be opened does. */
  underTopBar?: boolean;
}

/**
 * What covers a window whose place's server needs a sign-in (`SignInCover`): one screen, however many reads and
 * operations ran into it, with what to do, Details (what `cm` answered), Check again and Go to Home. The sign-in itself
 * is the Unity Version Control app's until this app signs in (docs/features/accounts.md).
 */
export function SignInScreen({ problem, underTopBar = true }: SignInScreenProps) {
  const client = useQueryClient();
  const goHome = useSession((state) => state.goHome);
  const [checking, setChecking] = useState(false);
  const words = signInWords(problem);
  const checkAgain = (): void => {
    setChecking(true);
    void checkSessionNow(client, problem.server).finally(() => setChecking(false));
  };
  const showDetails = (): void =>
    openDialog((close) => <ConnectionProblemDialog title={words.title} explanation={words.explanation} details={problem.details} offersSignInApp={words.offersSignInApp} onClose={close} />);

  return (
    <ScreenMessage
      underTopBar={underTopBar}
      icon={<KeyRound size={26} />}
      tone="warning"
      title={words.title}
      actions={
        <>
          <Button variant="primary" icon={<RefreshCw size={14} className={checking ? 'spinning' : undefined} />} onClick={checkAgain} disabled={checking}>
            {checking ? 'Checking…' : 'Check again'}
          </Button>
          <Button onClick={showDetails}>Details</Button>
          <Button variant="ghost" icon={<House size={14} />} onClick={goHome}>
            Go to Home
          </Button>
        </>
      }
    >
      <p>{words.explanation}</p>
    </ScreenMessage>
  );
}
