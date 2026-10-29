import { FileDiff, Tag } from 'lucide-react';
import { placeId, type Place } from '@shared/domain/place';
import type { LabelInfo } from '@shared/domain/label';
import { spec } from '@shared/domain/specs';
import { useShowInFollowingWindow } from '../../app/pageWindow/useShowInFollowingWindow';
import { commentDraftKey, DetailsHeading } from '../../components/DetailsHeading';
import { PLAIN_LINKS, type ObjectLinks } from '../../components/objectLinks';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsCopyable } from '../../ui/DetailsCopyable';
import { DetailsPanel } from '../../ui/DetailsPanel';
import { AttributeChips } from '../attributes/AttributeChips';
import { BranchChip } from '../branches/BranchChip';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { labelDiffPage, saveLabelComment, showLabelChanges } from './labelOperations';
import { copiedWhat } from '../../components/copyMenu';

interface LabelDetailsProps {
  place: Place;
  label: LabelInfo;
  /** The label's context menu, offered behind "More actions". */
  menu: MenuEntry[];
  links?: ObjectLinks;
}

export function LabelDetails({ place, label, menu, links = PLAIN_LINKS }: LabelDetailsProps) {
  useShowInFollowingWindow(labelDiffPage(label));
  return (
    <DetailsPanel
      icon={<Tag />}
      kind="Label"
      heading={<DetailsHeading name={label.name} comment={label.comment} onSave={(comment) => saveLabelComment(place, label, comment)} draftKey={commentDraftKey(placeId(place), 'label', label.name)} />}
      author={{ user: label.owner, date: label.date }}
      meta={[
        <DetailsCopyable key="changeset" text={spec.changeset(label.changeset)} what={copiedWhat('Changeset', 'spec')} />,
        <BranchChip key="branch" name={label.branch} onSelect={links.selectBranch} />,
      ]}
      attributes={<AttributeChips key={label.name} objectSpec={spec.label(label.name)} />}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => showLabelChanges(label)}>
          Open diff
        </Button>
      }
      menu={menu}
      primaryActionId="diff"
      properties={[
        { label: 'Created', value: formatDateTime(label.date) },
        { label: 'Changeset', value: links.changeset(label.changeset), copyText: spec.changeset(label.changeset) },
        { label: 'Branch', value: links.branch(label.branch) },
        { label: 'Repository', value: label.repository },
      ]}
      changes={<ChangedFilesSection target={{ kind: 'changeset', changesetId: label.changeset }} onOpen={(path) => showLabelChanges(label, path)} />}
    />
  );
}
