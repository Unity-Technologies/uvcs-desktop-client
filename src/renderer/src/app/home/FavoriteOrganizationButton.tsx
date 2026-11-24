import { Star } from 'lucide-react';
import { isFavoriteOrganization } from '@shared/domain/favoriteOrganizations';
import { IconButton } from '../../ui/IconButton';
import { setFavoriteOrganization, useSettings } from '../settings/useSettings';
import { canBeFavorite } from './serverGroups';

/** The star in an organization's header: adds it to the favorites the home sidebar lists first, filled once it is one. */
export function FavoriteOrganizationButton({ server }: { server: string }) {
  const favorite = isFavoriteOrganization(useSettings().favoriteOrganizations, server);
  if (!canBeFavorite(server)) return null;
  return (
    <IconButton
      icon={<Star size={14} fill={favorite ? 'currentColor' : 'none'} />}
      label={favorite ? 'Remove from favorites' : 'Add to favorites'}
      onClick={() => void setFavoriteOrganization(server, !favorite)}
    />
  );
}
