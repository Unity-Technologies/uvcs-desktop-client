import { DetailsDisclosure } from './DetailsDisclosure';
import { useDetailsLayoutStore } from './detailsLayoutStore';
import { PropertyList, type Property } from './PropertyList';
import styles from './MoreDetails.module.css';

/** A details panel's properties behind a "More details" disclosure, open or closed for every panel alike. */
export function MoreDetails({ properties }: { properties: Property[] }) {
  const { moreDetailsOpen: open, set } = useDetailsLayoutStore();
  return (
    <div className={styles.moreDetails}>
      <DetailsDisclosure open={open} onToggle={() => set({ moreDetailsOpen: !open })}>
        More details
      </DetailsDisclosure>
      {open && (
        <div className={styles.properties}>
          <PropertyList properties={properties} />
        </div>
      )}
    </div>
  );
}
