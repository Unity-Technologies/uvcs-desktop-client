import { Editor } from '@pierre/diffs/edit';
import { EditProvider, File } from '@pierre/diffs/react';
import { useState } from 'react';
import { usePierreOptions } from './usePierreOptions';
import styles from './TextSurface.module.css';

interface HandEditorProps {
  path: string;
  /** Where the editing starts: the merged text, conflict markers included. */
  text: string;
  onChange: (text: string) => void;
}

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/** Resolving a conflict by hand: the merged text, free to change. The editor owns the document, so its start stays fixed. */
export function HandEditor({ path, text, onChange }: HandEditorProps) {
  const options = usePierreOptions();
  const [initialText] = useState(text);

  return (
    <div className={styles.surface}>
      <EditProvider createEditor={createEditor}>
        <File file={{ name: path, contents: initialText }} disableWorkerPool options={options} edit onEditChange={(event) => onChange(event.file.contents)} />
      </EditProvider>
    </div>
  );
}
