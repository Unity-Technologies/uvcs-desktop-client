import type { ItemDetails, TreeItem } from '@shared/domain/explorer';
import { navigation } from '../../app/navigation/navigationStore';
import { pluralize } from '../../lib/text';
import { DetailsLink, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { openChangesetDiff } from '../changesets/changesetOperations';

interface FolderDetailsProps {
  item: TreeItem;
  /** Its listing, once the folder has been opened in the tree. */
  contents?: TreeItem[];
  /** Pending changes anywhere below it; undefined in a repository tree. */
  changesInside?: number;
  details?: ItemDetails;
}

/** A folder has no content to show: what it holds, what is pending in it and what last changed it (its heading has the rest). */
export function FolderDetails({ item, contents, changesInside, details }: FolderDetailsProps) {
  const folders = contents?.filter((child) => child.itemType === 'directory').length ?? 0;
  return (
    <DetailsSection title="Details">
      <PropertyList
        properties={[
          { label: 'Path', value: `/${item.path}`, mono: true, copyText: `/${item.path}` },
          { label: 'Contains', value: contents && (contents.length === 0 ? 'Nothing' : contentsLabel(folders, contents.length - folders)) },
          {
            label: 'Pending',
            value: changesInside ? <DetailsLink onClick={() => navigation.goToView('changes')}>{pluralize(changesInside, 'change')} inside</DetailsLink> : '',
          },
          {
            label: 'Last change',
            value: item.changeset > 0 && !item.isPrivate ? <DetailsLink onClick={() => openChangesetDiff({ id: item.changeset })}>cs:{item.changeset}</DetailsLink> : '',
          },
          { label: 'Repository', value: details?.repository },
          { label: 'Xlink to', value: details?.xlinkTarget },
          { label: 'Under xlink', value: details?.underXlinkTarget },
        ]}
      />
    </DetailsSection>
  );
}

function contentsLabel(folders: number, files: number): string {
  return [folders > 0 && pluralize(folders, 'folder'), files > 0 && pluralize(files, 'file')].filter(Boolean).join(' · ');
}
