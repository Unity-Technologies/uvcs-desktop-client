import { Editor } from '@pierre/diffs/edit';
import { EditProvider, File, UnresolvedFile } from '@pierre/diffs/react';
import { useState } from 'react';
import { Button } from '../../../ui/Button';
import { resolveConflictRegion, type ConflictLabels, type ConflictRegionChoice } from './threeWayMerge';
import { usePierreOptions } from './usePierreOptions';
import styles from './MergedTextEditor.module.css';

interface MergedTextEditorProps {
  path: string;
  text: string;
  labels: ConflictLabels;
  hasConflicts: boolean;
  editing: boolean;
  onChange: (text: string) => void;
}

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/**
 * The merged file. While conflicts remain, each one offers to keep the destination, the source or both.
 * In edit mode the text can be changed freely.
 */
export function MergedTextEditor({ path, text, labels, hasConflicts, editing, onChange }: MergedTextEditorProps) {
  const options = usePierreOptions();

  if (editing) return <EditableText path={path} text={text} onChange={onChange} />;

  if (!hasConflicts) {
    return (
      <div className={styles.surface}>
        <File file={{ name: path, contents: text }} disableWorkerPool options={options} />
      </div>
    );
  }

  const choose = (conflictIndex: number, choice: ConflictRegionChoice): void => onChange(resolveConflictRegion(text, conflictIndex, choice));

  return (
    <div className={styles.surface}>
      {/* The component keeps its own copy of the conflicts, so it is recreated whenever the text changes. */}
      <UnresolvedFile
        key={contentKey(text)}
        file={{ name: path, contents: text }}
        disableWorkerPool
        options={options}
        renderMergeConflictUtility={(action) => (
          <div className={styles.conflictActions}>
            <Button size="small" onClick={() => choose(action.conflictIndex, 'current')}>
              Keep {labels.destination}
            </Button>
            <Button size="small" onClick={() => choose(action.conflictIndex, 'incoming')}>
              Keep {labels.source}
            </Button>
            <Button size="small" variant="ghost" onClick={() => choose(action.conflictIndex, 'both')}>
              Keep both
            </Button>
          </div>
        )}
      />
    </div>
  );
}

/** The editor owns the document while editing; the text it started from must stay fixed. */
function EditableText({ path, text, onChange }: Pick<MergedTextEditorProps, 'path' | 'text' | 'onChange'>) {
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

/** A short key that changes whenever the text does. */
function contentKey(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = (hash * 33) ^ text.charCodeAt(index);
  return `${text.length}:${hash >>> 0}`;
}
