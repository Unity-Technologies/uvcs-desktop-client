import styles from './PathLabel.module.css';

interface PathLabelProps {
  path: string;
  /** Show only the file name (e.g. inside a folder tree). */
  nameOnly?: boolean;
  /** Previous path of a moved item. */
  oldPath?: string;
  strikethrough?: boolean;
}

/** `src/app/main.ts` rendered as a prominent file name followed by its dimmed folder. */
export function PathLabel({ path, nameOnly, oldPath, strikethrough }: PathLabelProps) {
  const separator = path.lastIndexOf('/');
  const name = path.slice(separator + 1);
  const directory = separator > 0 ? path.slice(0, separator) : '';

  return (
    <span className={styles.path} title={oldPath ? `${oldPath} → ${path}` : path}>
      <span className={styles.name} data-strikethrough={strikethrough}>
        {name}
      </span>
      {!nameOnly && directory && <span className={styles.directory}>{directory}</span>}
      {oldPath && <span className={styles.directory}>from {oldPath}</span>}
    </span>
  );
}
