import cube from '@phosphor-icons/core/bold/cube-bold.svg?raw';
import type { CSSProperties } from 'react';
import type { ProjectColor } from '@shared/domain/organizations';
import { svgPathOf } from '../lib/svgPath';
import { projectTileFill } from './projectTile';
import styles from './ProjectIcon.module.css';

/** Phosphor's Cube (Bold), the cube Unity Version Control's clients draw for a project, on its 256-unit grid. */
const CUBE_PATH = svgPathOf(cube);

/**
 * A Unity project as the other clients draw it: a white cube on a rounded tile in the project's color, picked by its
 * GUID (`projectTileFill`), so it is recognized from one client to the other. `size` is the tile's, in pixels.
 */
export function ProjectIcon({ size = 18, ...project }: ({ guid: string | undefined } | { color: ProjectColor }) & { size?: number }) {
  return (
    <span className={styles.tile} style={{ '--project-color': projectTileFill(project), width: size, height: size } as CSSProperties} aria-hidden>
      <svg width={Math.round(size * 0.68)} height={Math.round(size * 0.68)} viewBox="0 0 256 256" fill="currentColor" focusable="false">
        <path d={CUBE_PATH} />
      </svg>
    </span>
  );
}
