import { ChevronLeft } from 'lucide-react';
import { useIssueTrackerSetup } from '../../../components/issues/useIssueTrackers';
import { Button } from '../../../ui/Button';
import { AddSignInMenu } from './AddSignInMenu';
import { usableSignIns } from './connectFlow';
import type { ConnectStart } from './ConnectTracker';
import { SignInIdentity } from './SignInIdentity';
import { SignInMenu } from './SignInMenu';
import { choiceOf, NO_SIGN_INS, REPOSITORY_START_WORDS } from './trackerChoices';
import { TrackerLogo } from './TrackerLogo';
import { useSuggestedLink } from './useSuggestedLink';
import styles from './IssueTrackerPane.module.css';
import tileStyles from './SignInTiles.module.css';

/**
 * A repository with no tracker yet (docs/features/issue-trackers.md, "Connecting"), as Home's sign-ins read: the
 * sign-ins that work, each with Use and a ⋯ menu that signs out (`usableSignIns`, `SignInMenu`), or "No sign-ins yet";
 * "Add a sign-in" in the header offers the trackers. Above them, the tracker the branch comments link to, in one click
 * with its link filled in. Each starts Connect at its link step; changing a tracker already connected adds Back.
 */
export function RepositoryStart({ repository, onStart, onCancel }: { repository: string; onStart: (start: ConnectStart) => void; onCancel?: () => void }) {
  const signIns = usableSignIns(useIssueTrackerSetup(), repository);
  const suggestion = useSuggestedLink();
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
        {suggestion && (
          <div className={styles.suggested}>
            <TrackerLogo choice={suggestion.choice} size={24} />
            <div className={styles.cardHeaderText}>
              <span className={styles.nextTitle}>Your branch comments link to {suggestion.trackerName}</span>
              <span className={styles.personDetail}>
                {suggestion.words} · {suggestion.seen}
              </span>
            </div>
            <Button size="small" variant="primary" onClick={() => onStart({ choice: suggestion.choice, link: suggestion.link })}>
              Use it
            </Button>
          </div>
        )}
        {signIns.length > 0 ? (
          <>
            <h3 className={tileStyles.quietTitle}>{words.signIns}</h3>
            <ul className={tileStyles.tiles}>
              {signIns.map((signIn) => (
                <li key={signIn.id} className={tileStyles.signInTile} aria-label={`${signIn.account}, ${signIn.title}`}>
                  <SignInIdentity row={signIn} />
                  <Button size="small" variant="primary" onClick={() => onStart({ choice: choiceOf(signIn.kind), picked: signIn })}>
                    Use
                  </Button>
                  <SignInMenu row={signIn} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className={tileStyles.noSignIns}>
            <p className={styles.nextTitle}>{NO_SIGN_INS.title}</p>
            <p className={styles.note}>{NO_SIGN_INS.inRepository}</p>
          </div>
        )}
      </div>
    </section>
  );
}
