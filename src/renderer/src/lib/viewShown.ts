import { createContext } from 'react';

/**
 * Whether the view around is shown: false inside one kept mounted but hidden (the place's view under a page, a
 * review's tab not picked), which `useShortcut` reads to listen to none of its keys. Shown unless what hides a view
 * says otherwise.
 */
export const ViewShownContext = createContext(true);

