import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { gravatarChoice } from '@shared/domain/gravatarChoice';
import { usePeopleShown } from '../../lib/avatars/peopleShown';
import { Button } from '../../ui/Button';
import { useDialogStore } from '../../ui/dialog/dialogStore';
import { CornerCard, CornerCardText } from '../../ui/toast/CornerCard';
import { asksAboutGravatar } from './asksAboutGravatar';
import { saveSettings, settingsQuery } from './useSettings';

const answer = (show: boolean): void => void saveSettings(gravatarChoice(show));

/**
 * The corner card that asks, once, whether to show people's Gravatar pictures, when people first show (`asksAboutGravatar`).
 * It waits for an answer: nothing goes to Gravatar until "Show pictures", and the app quit unanswered asks again next time.
 */
export function GravatarPrompt() {
  const { data: settings } = useQuery(settingsQuery);
  const peopleShown = usePeopleShown();
  const dialogOpen = useDialogStore((state) => state.dialogs.length > 0);
  if (!asksAboutGravatar(settings, { peopleShown, dialogOpen })) return null;

  return (
    // A decision waiting on the user, read out like the update ready to install.
    <CornerCard
      role="alert"
      icon={<Users size={15} />}
      title="Show profile pictures?"
      actions={
        <>
          <Button variant="ghost" size="small" onClick={() => answer(false)}>
            Not now
          </Button>
          <Button variant="primary" size="small" onClick={() => answer(true)}>
            Show pictures
          </Button>
        </>
      }
    >
      <CornerCardText>Pictures come from Gravatar. To find them, the app sends a hash of each email address shown to gravatar.com.</CornerCardText>
    </CornerCard>
  );
}
