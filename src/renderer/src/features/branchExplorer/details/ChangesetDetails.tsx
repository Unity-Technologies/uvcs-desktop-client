import type { ObjectLinks } from '../../../components/objectLinks';
import type { MenuEntry } from '../../../lib/actions';
import type { Property } from '../../../ui/PropertyList';
import { ChangesetDetails as ChangesetDetailsPanel } from '../../changesets/ChangesetDetails';
import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import { MERGE_LINK_NAMES } from '../model/mergeLinkNames';

interface ChangesetDetailsProps {
  node: NodeLayout;
  layout: GraphLayout;
  menu: MenuEntry[];
  links: ObjectLinks;
}

/** The changeset details every view shows, plus the merges the graph draws to and from it. */
export function ChangesetDetails({ node, layout, menu, links }: ChangesetDetailsProps) {
  const { changeset } = node;
  const relations: Property[] = [
    ...layout.mergeLinks
      .filter((merge) => merge.destinationChangeset === changeset.id)
      .map((merge) => ({ label: `${MERGE_LINK_NAMES[merge.type]} from`, value: links.changeset(merge.sourceChangeset) })),
    ...layout.mergeLinks
      .filter((merge) => merge.sourceChangeset === changeset.id)
      .map((merge) => ({ label: 'Merged into', value: links.changeset(merge.destinationChangeset) })),
  ];

  return <ChangesetDetailsPanel changeset={changeset} menu={menu} links={links} relations={relations} />;
}
