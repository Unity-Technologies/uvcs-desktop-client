import type { ReactNode } from 'react';

/** How a details panel shows the changesets and branches it mentions: plain text, or links where the view can go to them. */
export interface ObjectLinks {
  changeset: (id: number) => ReactNode;
  branch: (name: string) => ReactNode;
  /** Goes to a branch from its chip in the meta row; without it the chip shows the branch in the Branch Explorer. */
  selectBranch?: (name: string) => void;
}

export const PLAIN_LINKS: ObjectLinks = {
  changeset: (id) => `Changeset ${id}`,
  branch: (name) => name,
};
