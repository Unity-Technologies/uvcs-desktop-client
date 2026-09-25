import type { ObjectLinks } from '../../../components/objectLinks';
import type { MenuEntry } from '../../../lib/actions';
import { pluralize } from '../../../lib/text';
import { BranchDetails as BranchDetailsPanel } from '../../branches/BranchDetails';
import type { GraphLayout, Lane } from '../model/layoutGraph';

interface BranchDetailsProps {
  lane: Lane;
  layout: GraphLayout;
  menu: MenuEntry[];
  links: ObjectLinks;
}

/** The branch details every view shows, plus where the branch sits in the graph. */
export function BranchDetails({ lane, layout, menu, links }: BranchDetailsProps) {
  const { branch } = lane;
  const changesetsInView = layout.nodesByColumn.filter((node) => node.changeset.branch === branch.name).length;

  return (
    <BranchDetailsPanel
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
