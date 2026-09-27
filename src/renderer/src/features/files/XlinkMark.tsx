import { Link2 } from 'lucide-react';
import type { XlinkTarget } from '@shared/domain/explorer';
import { ItemMark } from '../../components/ItemMark';
import { describeXlink } from './describeXlink';

/** An xlinked folder's quiet mark among its row's extras; where it points is in its tooltip. */
export function XlinkMark({ xlink }: { xlink: XlinkTarget }) {
  const { label, detail } = describeXlink(xlink);
  return <ItemMark icon={Link2} label={label} detail={detail} />;
}
