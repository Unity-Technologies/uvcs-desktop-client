import type { ReactNode } from 'react';

/** How a details panel shows the changesets and branches it mentions: plain text, or links where the view can go to them. */
export interface ObjectLinks {
  changeset: (id: number) => ReactNode;
  branch: (name: string) => ReactNode;
}

export const PLAIN_LINKS: ObjectLinks = {
  changeset: (id) => `Changeset ${id}`,
  branch: (name) => name,
};
