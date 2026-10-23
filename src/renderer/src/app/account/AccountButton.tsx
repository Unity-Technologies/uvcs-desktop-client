import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { displayName } from '../../lib/userName';
import { Avatar } from '../../ui/Avatar';
import { usePlaceServer } from '../workspace/useWorkspace';
import { useServerAccount } from './accounts';
import { AccountMenu } from './AccountMenu';
import { organizationName } from './serverAccount';
import styles from './AccountMenu.module.css';

/** Who you are on the server of the window's place (`usePlaceServer`), at the right end of the top bar; opens the account menu. */
export function AccountButton() {
  const [open, setOpen] = useState(false);
  const placeServer = usePlaceServer();
  const identity = useServerAccount(placeServer);
  if (!placeServer || !identity) return null;

  const server = organizationName(placeServer, identity.account) ?? placeServer;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className={styles.trigger} aria-label="Account" data-tip={displayName(identity.user)} data-tip-sub={`${identity.user} · ${server}`}>
          <Avatar user={identity.user} size={24} tip={null} ownAccount />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} side="bottom" align="end" sideOffset={6}>
          <AccountMenu server={placeServer} identity={identity} onDone={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
