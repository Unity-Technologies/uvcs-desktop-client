import { navigation } from '../../app/navigation/navigationStore';
import { Button } from '../../ui/Button';
import styles from './ReviewChangesButton.module.css';

/**
 * "Review changes" in the footer of a dialog that asks what happens to the pending changes: closes the dialog
 * (`dismiss`, so nothing happens) and opens Changes.
 */
export function ReviewChangesButton({ dismiss }: { dismiss: () => void }) {
  return (
    <Button
      variant="ghost"
      className={styles.review}
      onClick={() => {
        dismiss();
        navigation.goToView('changes');
      }}
    >
      Review changes
    </Button>
  );
}
