import { DATE_RULER_HEIGHT } from './canvas/geometry';
import { graphSkeletonShapes } from './graphSkeletonShapes';
import styles from './GraphSkeleton.module.css';

const SHAPES = graphSkeletonShapes();

/** The graph's pane while the history is read: the date ruler, and a few branches where the real ones will be drawn. */
export function GraphSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Loading">
      <div className={styles.ruler} style={{ height: DATE_RULER_HEIGHT }} />
      <svg className={styles.graph} aria-hidden>
        {SHAPES.links.map((link, index) => (
          <polyline key={`link-${index}`} className={styles.link} points={link.points.map(({ x, y }) => `${x},${y}`).join(' ')} />
        ))}
        {SHAPES.bands.map((band, index) => (
          <rect key={`band-${index}`} className={styles.band} x={band.x} y={band.y} width={band.width} height={band.height} rx={band.height / 2} />
        ))}
        {SHAPES.headers.map((header, index) => (
          <rect key={`header-${index}`} className={styles.mark} x={header.x} y={header.y} width={header.width} height={header.height} rx={4} />
        ))}
        {SHAPES.nodes.map((node, index) => (
          <circle key={`node-${index}`} className={styles.mark} cx={node.x} cy={node.y} r={node.radius} />
        ))}
      </svg>
    </div>
  );
}
