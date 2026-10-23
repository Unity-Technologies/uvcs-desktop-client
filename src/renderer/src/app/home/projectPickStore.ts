import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProjectPickStore {
  /** The project picked in each Unity organization's repositories, by server; none for all projects. */
  picks: Record<string, string>;
  pick: (server: string, project: string | null) => void;
}

/**
 * The project each organization's repositories were last narrowed to, across sessions: people work in a project
 * or two of an organization holding many. A project picked that is gone shows all of them (`shownProject`).
 */
export const useProjectPickStore = create<ProjectPickStore>()(
  persist(
    (set) => ({
      picks: {},
      pick: (server, project) => set(({ picks }) => ({ picks: withPick(picks, server, project) })),
    }),
    { name: 'home-project-picks', partialize: ({ picks }) => ({ picks }) },
  ),
);

/** `picks` with the server's project picked, or forgotten for all projects. */
export function withPick(picks: Readonly<Record<string, string>>, server: string, project: string | null): Record<string, string> {
  const { [server]: _previous, ...others } = picks;
  return project === null ? others : { ...others, [server]: project };
}
