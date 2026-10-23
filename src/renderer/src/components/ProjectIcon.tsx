import type { CSSProperties } from 'react';
import { projectColor } from '@shared/domain/organizations';
import styles from './ProjectIcon.module.css';

/** The cube Unity Version Control's clients draw for a Unity project, on its 256-unit grid. */
const CUBE_PATH =
  'M225.6,62.64l-88-48.17a19.91,19.91,0,0,0-19.2,0l-88,48.17A20,20,0,0,0,20,80.19v95.62a20,20,0,0,0,10.4,17.55l88,48.17a19.89,19.89,0,0,0,19.2,0l88-48.17A20,20,0,0,0,236,175.81V80.19A20,20,0,0,0,225.6,62.64ZM128,36.57,200,76,128,115.4,56,76ZM44,96.79l72,39.4v76.67L44,173.44Zm96,116.07V136.19l72-39.4v76.65Z';

/**
 * A Unity project as the other clients draw it: a white cube on a rounded tile in the project's color, picked by its
 * GUID (`projectColor`), so it is recognized from one client to the other. A project whose GUID isn't read yet is
 * neutral rather than a color it may not have. `size` is the tile's, in pixels.
 */
export function ProjectIcon({ guid, size = 18 }: { guid: string | undefined; size?: number }) {
  const color = guid === undefined ? 'var(--text-tertiary)' : `var(--project-${projectColor(guid)})`;
  return (
    <span className={styles.tile} style={{ '--project-color': color, width: size, height: size } as CSSProperties} aria-hidden>
      <svg width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} viewBox="0 0 256 256" fill="currentColor" focusable="false">
        <path d={CUBE_PATH} />
      </svg>
    </span>
  );
}
