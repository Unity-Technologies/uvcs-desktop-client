import { SkeletonBar, SkeletonRows, skeletonWidth } from '../../ui/Skeleton';
import styles from './Home.module.css';

/** Workspace rows while the list loads: an avatar, then a name and a path. */
export function WorkspaceListSkeleton() {
  return (
    <SkeletonRows rowHeight={48} rowClassName={styles.skeletonRow}>
      {(index) => (
        <>
          <span className={styles.skeletonAvatar}>
            <SkeletonBar width="100%" />
          </span>
          <span className={styles.skeletonText}>
            <SkeletonBar width={skeletonWidth(index, 0)} />
            <SkeletonBar width={skeletonWidth(index, 1)} />
          </span>
        </>
      )}
    </SkeletonRows>
  );
}
