import { useEffect } from 'react';
import { showsGravatar } from '@shared/domain/gravatarChoice';
import { api } from '../../api/client';
import { setAvatarPictureSource, type AvatarPictureSource } from '../../lib/avatars/avatarImages';
import { useSettings } from './useSettings';

/** The main process fetches the picture, so someone without one (a 404) doesn't log a console error. */
const gravatar: AvatarPictureSource = (user, size) => api.system.gravatar(user, size);

/** Avatars show Gravatar pictures only once the user turned "Show profile pictures from Gravatar" on. */
export function useGravatarSetting(): void {
  const shows = showsGravatar(useSettings());
  useEffect(() => setAvatarPictureSource(shows ? gravatar : null), [shows]);
}
