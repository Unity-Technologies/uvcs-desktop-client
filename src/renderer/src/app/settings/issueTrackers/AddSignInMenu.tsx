import { Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '../../../ui/Button';
import { DescribedMenu } from '../../../ui/menu/DescribedMenu';
import { TRACKER_CHOICES, type TrackerChoice } from './trackerChoices';
import { TrackerLogo } from './TrackerLogo';

/**
 * "Add a sign-in": a button whose menu offers the trackers (`TRACKER_CHOICES`), each its logo, its name and, under it,
 * its servers. The one picked starts Connect at its link step.
 */
export function AddSignInMenu({ onAdd }: { onAdd: (choice: TrackerChoice) => void }) {
  const items = TRACKER_CHOICES.map((card) => ({ id: `add-${card.choice}`, label: card.name, description: card.servers, icon: LOGO_ICONS[card.choice], run: () => onAdd(card.choice) }));
  return (
    <DescribedMenu items={items} iconSize={24}>
      <Button size="small" icon={<Plus size={14} />}>
        Add a sign-in
      </Button>
    </DescribedMenu>
  );
}

/** Each tracker's logo as a menu's icon, at the size the menu asks. */
const LOGO_ICONS: Record<TrackerChoice, (props: { size?: number }) => ReactElement> = {
  jira: ({ size = 16 }) => <TrackerLogo choice="jira" size={size} />,
  github: ({ size = 16 }) => <TrackerLogo choice="github" size={size} />,
};
