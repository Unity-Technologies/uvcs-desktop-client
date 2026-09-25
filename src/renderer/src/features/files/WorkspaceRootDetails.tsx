import { FolderRoot } from 'lucide-react';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import type { MenuEntry } from '../../lib/actions';
import { DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';

const SELECTOR_LABELS: Record<WorkspaceInfo['selector']['kind'], string> = {
  branch: 'Branch',
  label: 'Label',
  changeset: 'Changeset',
  shelve: 'Shelve',
};

/** The workspace root selected in Files: which workspace this is and what it has loaded. */
export function WorkspaceRootDetails({ workspace, menu }: { workspace: WorkspaceInfo; menu: MenuEntry[] }) {
  return (
    <DetailsPanel icon={<FolderRoot />} kind="Workspace" context={workspace.repository} title={workspace.name} menu={menu}>
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Path', value: workspace.path, mono: true, copyText: workspace.path },
            { label: 'Repository', value: workspace.repository },
            { label: SELECTOR_LABELS[workspace.selector.kind], value: workspace.selector.name },
            { label: 'Loaded changeset', value: workspace.loadedChangeset },
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
