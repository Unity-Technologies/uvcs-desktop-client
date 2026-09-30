import type { ObjectLinks } from '../../../components/objectLinks';
import type { MenuEntry } from '../../../lib/actions';
import type { Property } from '../../../ui/PropertyList';
import { ChangesetDetails } from '../../changesets/ChangesetDetails';
import type { GraphLayout, NodeLayout } from '../model/layoutGraph';
import { MERGE_LINK_NAMES } from '../model/mergeLinkNames';

interface GraphChangesetDetailsProps {
  node: NodeLayout;
  layout: GraphLayout;
  menu: MenuEntry[];
  links: ObjectLinks;
}

/** The changeset details every view shows, plus the merges the graph draws to and from it. */
export function GraphChangesetDetails({ node, layout, menu, links }: GraphChangesetDetailsProps) {
  const { changeset } = node;
  const relations: Property[] = [
    ...layout.mergeLinks
      .filter((merge) => merge.destinationChangeset === changeset.id)
      .map((merge) => ({ label: `${MERGE_LINK_NAMES[merge.type]} from`, value: links.changeset(merge.sourceChangeset) })),
    ...layout.mergeLinks
      .filter((merge) => merge.sourceChangeset === changeset.id)
      .map((merge) => ({ label: 'Merged into', value: links.changeset(merge.destinationChangeset) })),
  ];

  return <ChangesetDetails changeset={changeset} menu={menu} links={links} relations={relations} />;
}
