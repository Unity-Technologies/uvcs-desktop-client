import { Editor } from '@pierre/diffs/edit';
import { EditProvider, File, UnresolvedFile } from '@pierre/diffs/react';
import { useState } from 'react';
import { Button } from '../../../ui/Button';
import type { MergeLabels } from '../mergeDescription';
import { ReadOnlyText } from './ReadOnlyText';
import { resolveConflictRegion, type ConflictRegionChoice } from './threeWayMerge';
import { usePierreOptions } from './usePierreOptions';
import styles from './MergedTextEditor.module.css';

interface MergedTextEditorProps {
  path: string;
  text: string;
  labels: MergeLabels;
  hasConflicts: boolean;
  editing: boolean;
  onChange: (text: string) => void;
}

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/**
 * The merged file, read-only. While conflicts remain, each one offers to keep the destination, the source or both.
 * Only in edit mode, which the user asks for, can the text be changed freely.
 */
export function MergedTextEditor({ path, text, labels, hasConflicts, editing, onChange }: MergedTextEditorProps) {
  const options = usePierreOptions();

  if (editing) return <EditableText path={path} text={text} onChange={onChange} />;
  if (!hasConflicts) return <ReadOnlyText path={path} text={text} />;

  const choose = (conflictIndex: number, choice: ConflictRegionChoice): void => onChange(resolveConflictRegion(text, conflictIndex, choice));
  const { source, destination } = labels.roles;

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
            <Button size="small" data-tip={`Keep these lines as ${labels.destination} has them`} onClick={() => choose(action.conflictIndex, 'current')}>
              Keep {destination.name.toLowerCase()}
            </Button>
            <Button size="small" data-tip={`Keep these lines as ${labels.source} has them`} onClick={() => choose(action.conflictIndex, 'incoming')}>
              Keep {source.name.toLowerCase()}
            </Button>
            <Button
              size="small"
              variant="ghost"
              data-tip={`Keep the lines of both: ${labels.destination} first, then ${labels.source}`}
              onClick={() => choose(action.conflictIndex, 'both')}
            >
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
