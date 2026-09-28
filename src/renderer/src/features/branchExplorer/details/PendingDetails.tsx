import { CircleDashed, FileDiff } from 'lucide-react';
import { navigation } from '../../../app/navigation/navigationStore';
import { DetailsHeading } from '../../../components/DetailsHeading';
import type { ObjectLinks } from '../../../components/objectLinks';
import { pluralize } from '../../../lib/text';
import { Button } from '../../../ui/Button';
import { DetailsPanel, DetailsSection } from '../../../ui/DetailsPanel';
import { PropertyList } from '../../../ui/PropertyList';
import type { PendingNode } from '../model/layoutGraph';
import { MERGE_LINK_NAMES } from '../model/mergeLinkNames';

interface PendingDetailsProps {
  pending: PendingNode;
  count: number;
  links: ObjectLinks;
}

/** The workspace's pending changes, selected as the changeset they will become: what they are on, and the merges in progress. */
export function PendingDetails({ pending, count, links }: PendingDetailsProps) {
  return (
    <DetailsPanel
      icon={<CircleDashed />}
      kind="Pending changes"
      heading={<DetailsHeading name={pluralize(count, 'change')} comment="Not checked in yet" />}
      meta={[<span key="parent">On {links.changeset(pending.parent)}</span>, <span key="branch">{links.branch(pending.branch)}</span>]}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => navigation.goToView('changes')}>
          Open Changes
        </Button>
      }
    >
      {pending.mergeLinks.length > 0 && (
        <DetailsSection title="In progress">
          <PropertyList
            properties={pending.mergeLinks.map((link) => ({
              label: `${MERGE_LINK_NAMES[link.type]} from`,
              value:
                link.intervalStart === undefined ? (
                  links.changeset(link.sourceChangeset)
                ) : (
                  <>
                    after {links.changeset(link.intervalStart)} up to {links.changeset(link.sourceChangeset)}
                  </>
                ),
            }))}
          />
        </DetailsSection>
      )}
    </DetailsPanel>
  );
}
