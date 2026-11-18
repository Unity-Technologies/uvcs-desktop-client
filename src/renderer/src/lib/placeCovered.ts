import { createContext } from 'react';

/**
 * Whether what's around is covered by the sign-in screen (`SignInCover`): its keys are off then, as `useShortcut`
 * reads it, so nothing works on the place unseen. Not covered unless the screen says so.
 */
export const PlaceCoveredContext = createContext(false);
