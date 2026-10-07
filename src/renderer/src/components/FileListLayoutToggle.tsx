import { List, ListTree } from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useFileListLayoutStore, type FileListLayout } from './fileListLayoutStore';

/** List or Tree: the one switch of every list of changed files, which switches them all. */
export function FileListLayoutToggle() {
  const layout = useFileListLayoutStore((state) => state.layout);
  const setLayout = useFileListLayoutStore((state) => state.setLayout);
  return (
    <SegmentedControl<FileListLayout>
      value={layout}
      onChange={setLayout}
      label="Show files as"
      segments={[
        { value: 'list', label: <List size={13} />, title: 'List' },
        { value: 'tree', label: <ListTree size={13} />, title: 'Tree' },
      ]}
    />
  );
}
