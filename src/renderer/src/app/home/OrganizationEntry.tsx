import type { ReactNode } from 'react';
import { isFavoriteOrganization } from '@shared/domain/favoriteOrganizations';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { useInRail } from '../../ui/nav/SidebarNav';
import { useSettings } from '../settings/useSettings';
import { FavoriteOrganizationButton } from './FavoriteOrganizationButton';
import { organizationMenu } from './homeMenus';
import styles from './OrganizationEntry.module.css';

/**
 * An organization's entry in the home sidebar (`children`, its `NavItem`): a star on hover adds it to the favorites
 * or takes it out, as its menu does on a right click. Folded, the rail's tiles show no star; the menu stays.
 */
export function OrganizationEntry({ server, children }: { server: string; children: ReactNode }) {
  const favorite = isFavoriteOrganization(useSettings().favoriteOrganizations, server);
  const rail = useInRail();
  return (
    <ActionContextMenu entries={() => organizationMenu(server, favorite)}>
      <div className={styles.entry} data-starred={!rail || undefined}>
        {children}
        {!rail && <FavoriteOrganizationButton server={server} size="small" className={styles.star} />}
      </div>
    </ActionContextMenu>
  );
}
