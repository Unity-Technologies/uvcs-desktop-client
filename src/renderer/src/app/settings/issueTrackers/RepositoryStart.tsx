import { ChevronLeft } from 'lucide-react';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { AddSignInMenu } from './AddSignInMenu';
import { linkReadBack, usableSignIns } from './connectFlow';
import type { ConnectStart } from './ConnectTracker';
import { SignInIdentity } from './SignInIdentity';
import { choiceOf, REPOSITORY_START_WORDS } from './trackerChoices';
import { TrackerLogo } from './TrackerLogo';
import { useSuggestedLink } from './useSuggestedLink';
import styles from './IssueTrackerPane.module.css';

/**
 * A repository with no tracker yet (docs/features/issue-trackers.md, "Connecting"), as Home's sign-ins read: the sign-ins
 * that work, each with Use (`usableSignIns`), or "No sign-ins yet"; "Add a sign-in" in the header offers the trackers.
 * Above them, the tracker the branch comments link to, in one click with its link filled in. Each starts Connect at
 * its link step; changing a tracker already connected adds Back.
 */
export function RepositoryStart({ onStart, onCancel }: { onStart: (start: ConnectStart) => void; onCancel?: () => void }) {
  const signIns = usableSignIns(useIssueTrackerSetup());
  const suggestion = useSuggestedLink();
  const suggested = suggestion && linkReadBack(suggestion.link);
  const words = REPOSITORY_START_WORDS;
  return (
    <section className={styles.card} aria-label="Connect an issue tracker">
      <header className={styles.cardHeader}>
        {onCancel && <Button size="small" variant="ghost" className={styles.back} icon={<ChevronLeft size={15} />} aria-label="Back" onClick={onCancel} />}
        <div className={styles.cardHeaderText}>
          <h2 className={styles.cardTitle}>{words.title}</h2>
        </div>
        <AddSignInMenu onAdd={(choice) => onStart({ choice })} />
      </header>
      <div className={styles.section}>
        <p className={styles.intro}>{words.intro}</p>
        {suggestion && suggested?.kind === 'read' && (
          <div className={styles.suggested}>
            <TrackerLogo choice={choiceOf(suggested.link.kind)} size={24} />
            <div className={styles.cardHeaderText}>
              <span className={styles.nextTitle}>Your branch comments link to {suggestion.trackerName}</span>
              <span className={styles.personDetail}>
                {suggestion.words} · {suggestion.seen}
              </span>
            </div>
            <Button size="small" variant="primary" onClick={() => onStart({ choice: choiceOf(suggested.link.kind), link: suggestion.link })}>
              Use it
            </Button>
          </div>
        )}
        {signIns.length > 0 ? (
          <>
            <h3 className={styles.quietTitle}>{words.signIns}</h3>
            <ul className={styles.tiles}>
              {signIns.map((signIn) => (
                <li key={signIn.id} className={styles.signInTile} aria-label={`${signIn.account}, ${signIn.title}`}>
                  <SignInIdentity row={signIn} />
                  <Button size="small" variant="primary" onClick={() => onStart({ choice: choiceOf(signIn.kind), picked: signIn })}>
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className={styles.noSignIns}>
            <p className={styles.nextTitle}>{words.noneTitle}</p>
            <p className={styles.note}>{words.none}</p>
          </div>
        )}
      </div>
    </section>
  );
}
