import { useEffect } from 'react';
import { setAvatarImagesEnabled } from '../../lib/avatars/avatarImages';
import { useSettings } from './useSettings';

/** Avatars show Gravatar pictures only while "Show profile pictures from Gravatar" is on. */
export function useGravatarSetting(): void {
  const { showGravatar } = useSettings();
  useEffect(() => setAvatarImagesEnabled(showGravatar), [showGravatar]);
}
