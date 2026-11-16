import type { ObjectLinks } from '../../../components/objectLinks';
import type { MenuEntry } from '../../../lib/actions';
import { pluralize } from '../../../lib/text';
import { BranchDetails } from '../../branches/BranchDetails';
import type { GraphLayout, Lane } from '../model/layoutGraph';

interface GraphBranchDetailsProps {
  lane: Lane;
  layout: GraphLayout;
  menu: MenuEntry[];
  links: ObjectLinks;
}

/** The branch details every view shows, plus where the branch sits in the graph. */
export function GraphBranchDetails({ lane, layout, menu, links }: GraphBranchDetailsProps) {
  const { branch } = lane;
  const changesetsInView = layout.nodesByColumn.filter((node) => node.changeset.branch === branch.name).length;

  return (
    <BranchDetails
      branch={branch}
      menu={menu}
      links={links}
      relations={[
        { label: 'Starts from', value: lane.baseChangeset !== null ? links.changeset(lane.baseChangeset) : '' },
        { label: 'In view', value: pluralize(changesetsInView, 'changeset') },
      ]}
    />
  );
}
