import { Star } from 'lucide-react';
import { isFavoriteOrganization } from '@shared/domain/favoriteOrganizations';
import { describeServer } from '../../lib/servers';
import { IconButton } from '../../ui/IconButton';
import { setFavoriteOrganization, useSettings } from '../settings/useSettings';
import { canBeFavorite, favoriteButtonLabel } from './serverGroups';

interface FavoriteOrganizationButtonProps {
  server: string;
  /** Small, on a sidebar row; the header's size otherwise. */
  size?: 'small';
  className?: string;
}

/**
 * The star that adds an organization to the favorites the home sidebar lists first, filled once it is one, which takes
 * it out again: in the organization's header, and on its sidebar row.
 */
export function FavoriteOrganizationButton({ server, size, className }: FavoriteOrganizationButtonProps) {
  const favorite = isFavoriteOrganization(useSettings().favoriteOrganizations, server);
  if (!canBeFavorite(server)) return null;
  return (
    <IconButton
      size={size}
      className={className}
      icon={<Star size={size ? 13 : 14} fill={favorite ? 'currentColor' : 'none'} />}
      // Named, as a sidebar holds one star per organization.
      label={favoriteButtonLabel(describeServer(server).label, favorite)}
      onClick={() => void setFavoriteOrganization(server, !favorite)}
    />
  );
}

