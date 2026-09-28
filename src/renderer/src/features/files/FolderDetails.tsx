import type { ItemDetails, TreeItem } from '@shared/domain/explorer';
import { navigation } from '../../app/navigation/navigationStore';
import { useOtherRepository } from '../../app/workspace/useWorkspace';
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
  // Under an xlink, its changeset is the xlinked repository's: no diff of the workspace's has it.
  const otherRepository = useOtherRepository(item.repository);
  const lastChange = item.changeset > 0 && !item.isPrivate && `cs:${item.changeset}`;
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
            value: !lastChange ? '' : otherRepository ? `${lastChange} in ${otherRepository}` : <DetailsLink onClick={() => openChangesetDiff({ id: item.changeset })}>{lastChange}</DetailsLink>,
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
