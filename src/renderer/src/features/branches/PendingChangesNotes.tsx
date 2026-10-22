import styles from './PendingChangesNotes.module.css';

/** Things worth knowing before choosing what happens to the pending changes (`switchNotes`), under the choice. */
export function PendingChangesNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className={styles.notes}>
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}
