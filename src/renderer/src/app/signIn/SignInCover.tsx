import { useEffect, type ReactNode } from 'react';
import { forgetRefusedOperation } from './refusedOperation';
import { SignInScreen } from './SignInScreen';
import styles from './SignInCover.module.css';
import { useServerSessions } from './useServerSessions';
import { useWindowSessionCheck } from './useSessionCheck';
import { signInCovering } from './windowSignIn';

/**
 * A place's screen under its top bar: covered by the sign-in screen while the place's server needs a sign-in
 * (`signInCovering`), a card over the work blurred, so the user sees it's still there. What it covers stays mounted,
 * `inert` (nothing in it takes focus or clicks), so what was typed or selected is there again once signed in. Checks
 * the place's server as it opens and as the window comes forward (`useWindowSessionCheck`). Covers a page window's
 * page too, where Go to Home isn't offered (`offersHome`): the page window has no home screen.
 */
export function SignInCover({ children, offersHome = true }: { children: ReactNode; offersHome?: boolean }) {
  const { server } = useWindowSessionCheck();
  const { data: sessions } = useServerSessions();
  const problem = signInCovering(sessions, server);
  // An operation refused here is offered again only while the window shows this place.
  useEffect(() => forgetRefusedOperation, []);

  return (
    <div className={styles.cover}>
      <div className={styles.covered} inert={problem !== null}>
        {children}
      </div>
      {problem && (
        <div className={styles.screen}>
          <SignInScreen problem={problem} as="card" offersHome={offersHome} />
        </div>
      )}
    </div>
  );
}
