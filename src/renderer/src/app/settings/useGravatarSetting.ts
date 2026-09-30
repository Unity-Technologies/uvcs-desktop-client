import { useEffect } from 'react';
import { api } from '../../api/client';
import { setAvatarPictureSource, type AvatarPictureSource } from '../../lib/avatars/avatarImages';
import { useSettings } from './useSettings';

/** The main process fetches the picture, so someone without one (a 404) doesn't log a console error. */
const gravatar: AvatarPictureSource = (user, size) => api.system.gravatar(user, size);

/** Avatars show Gravatar pictures only while "Show profile pictures from Gravatar" is on. */
export function useGravatarSetting(): void {
  const { showGravatar } = useSettings();
  useEffect(() => setAvatarPictureSource(showGravatar ? gravatar : null), [showGravatar]);
}
