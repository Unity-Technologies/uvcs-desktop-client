import { useEffect, useRef, type ReactNode } from 'react';
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
  const covers = problem !== null;
  const screen = useRef<HTMLDivElement>(null);
  // An operation refused here is offered again only while the window shows this place.
  useEffect(() => forgetRefusedOperation, []);
  // A menu, popover or card a covered view opened lives outside it, in the page's body, above the screen: a press on
  // the screen closes them, as a click outside them would (Radix's layers and the app's cards listen for it). In a task
  // of its own: closing a menu flushes React's work, which it refuses from inside an effect.
  useEffect(() => {
    if (!covers) return undefined;
    const pressed = setTimeout(() => screen.current?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    return () => clearTimeout(pressed);
  }, [covers]);

  return (
    <div className={styles.cover}>
      <div className={styles.covered} inert={covers}>
        {children}
      </div>
      {problem && (
        <div ref={screen} className={styles.screen}>
          <SignInScreen problem={problem} as="card" offersHome={offersHome} />
        </div>
      )}
    </div>
  );
}
