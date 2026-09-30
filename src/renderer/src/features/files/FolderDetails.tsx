import type { ReactNode } from 'react';
import type { ItemDetails, TreeItem } from '@shared/domain/explorer';
import { navigation } from '../../app/navigation/navigationStore';
import { useOtherRepository } from '../../app/workspace/useWorkspace';
import { pluralize } from '../../lib/text';
import { DetailsLink } from '../../ui/DetailsLink';
import { DetailsSection } from '../../ui/DetailsSection';
import { PropertyList } from '../../ui/PropertyList';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { showShelveChanges } from '../shelves/shelveOperations';

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
            value: lastChangeOf(item, otherRepository),
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

/** What last changed the folder: its changeset, or on a shelve the shelve (a workspace on one lists its revisions). */
function lastChangeOf({ isPrivate, changeset, shelveId }: TreeItem, otherRepository: string | undefined): ReactNode {
  if (isPrivate) return '';
  if (changeset === null) return shelveId !== undefined && <DetailsLink onClick={() => showShelveChanges({ id: shelveId })}>sh:{shelveId}</DetailsLink>;
  if (changeset <= 0) return '';
  return otherRepository ? `cs:${changeset} in ${otherRepository}` : <DetailsLink onClick={() => openChangesetDiff({ id: changeset })}>cs:{changeset}</DetailsLink>;
}
