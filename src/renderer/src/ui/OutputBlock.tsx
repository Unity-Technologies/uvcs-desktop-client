import styles from './OutputBlock.module.css';

/** A command's raw output, however long: monospaced, scrollable, selectable and never clipped. */
export function OutputBlock({ output }: { output: string }) {
  return (
    <pre className={`${styles.output} selectable`} tabIndex={0}>
      {output || 'The command printed nothing.'}
    </pre>
  );
}
