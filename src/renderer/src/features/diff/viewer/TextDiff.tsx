import { Editor } from '@pierre/diffs/edit';
import { EditProvider, MultiFileDiff } from '@pierre/diffs/react';
import { useMemo } from 'react';
import { useResolvedTheme } from '../../../app/settings/useResolvedTheme';
import { useDiffPreferences } from './diffPreferencesStore';
import { pierreDiffOptions } from './pierreOptions';
import styles from './TextDiff.module.css';

interface TextDiffProps {
  original: string;
  modified: string;
  /** Used for the language of the syntax highlighting. */
  fileName: string;
  /** Lets the user type into the modified side. */
  editing?: boolean;
  /** Receives the modified side's text after every edit. */
  onEdit?: (text: string) => void;
}

const createEditor: React.ComponentProps<typeof EditProvider>['createEditor'] = (type, options, key) => new Editor(type, options, key);

/** Syntax-highlighted text diff, side by side or unified, optionally editable on the modified side. */
export function TextDiff({ original, modified, fileName, editing = false, onEdit }: TextDiffProps) {
  const theme = useResolvedTheme();
  const { layout, collapseUnchanged, wrapLines } = useDiffPreferences();
  // Stable inputs: new objects would make Pierre reload the files and drop an ongoing edit.
  const oldFile = useMemo(() => ({ name: fileName, contents: original }), [fileName, original]);
  const newFile = useMemo(() => ({ name: fileName, contents: modified }), [fileName, modified]);
  const options = useMemo(
    () => pierreDiffOptions({ theme, layout, collapseUnchanged, wrapLines }),
    [theme, layout, collapseUnchanged, wrapLines],
  );

  return (
    <div className={styles.diff}>
      <EditProvider createEditor={createEditor}>
        <MultiFileDiff
          oldFile={oldFile}
          newFile={newFile}
          options={options}
          edit={editing}
          onEditChange={(event) => onEdit?.(event.editor.getText())}
          onEditComplete={() => 'reject'}
          disableWorkerPool
          style={{ minHeight: '100%' }}
        />
      </EditProvider>
    </div>
  );
}
