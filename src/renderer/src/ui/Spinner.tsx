import styles from './Spinner.module.css';

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

export function CenteredSpinner() {
  return (
    <div className={styles.centered}>
      <Spinner size={20} />
    </div>
  );
}
