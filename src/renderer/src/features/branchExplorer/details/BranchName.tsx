import { DetailsLink } from '../../../ui/DetailsLink';
import { HueDot } from '../HueDot';
import { branchHue } from '../model/branchHue';
import styles from './BranchName.module.css';

/** A branch name with its graph color, selecting the branch when clicked. */
export function BranchName({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <DetailsLink onClick={onClick}>
      <span className={styles.dot}>
        <HueDot hue={branchHue(name)} />
      </span>
      {name}
    </DetailsLink>
  );
}
