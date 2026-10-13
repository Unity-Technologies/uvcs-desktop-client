import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { gravatarChoice } from '@shared/domain/gravatarChoice';
import { usePeopleShown } from '../../lib/avatars/peopleShown';
import { Button } from '../../ui/Button';
import { asksAboutGravatar } from './asksAboutGravatar';
import { saveSettings, settingsQuery } from './useSettings';
import styles from './GravatarPrompt.module.css';

const answer = (show: boolean): void => void saveSettings(gravatarChoice(show));

/**
 * The corner card that asks, once, whether to show people's Gravatar pictures, when people first show (`asksAboutGravatar`).
 * It waits for an answer: nothing goes to Gravatar until "Show pictures", and the app quit unanswered asks again next time.
 */
export function GravatarPrompt() {
  const { data: settings } = useQuery(settingsQuery);
  const peopleShown = usePeopleShown();
  if (!asksAboutGravatar(settings, peopleShown)) return null;

  return (
    <div className={styles.card} role="status">
      <div className={styles.row}>
        <Users size={15} className={styles.icon} />
        <span className={styles.title}>Show profile pictures?</span>
      </div>
      <p className={styles.text}>Pictures come from Gravatar. To find them, the app sends a hash of each email address shown to gravatar.com.</p>
      <div className={styles.actions}>
        <Button variant="ghost" size="small" onClick={() => answer(false)}>
          Not now
        </Button>
        <Button variant="primary" size="small" onClick={() => answer(true)}>
          Show pictures
        </Button>
      </div>
    </div>
  );
}
