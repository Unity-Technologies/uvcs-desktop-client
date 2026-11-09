import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronsDownUp, ChevronsUpDown, ListOrdered } from 'lucide-react';
import type { Icon } from '../../../lib/actions';
import { Button } from '../../../ui/Button';
import { focusAfterMenu } from '../../../ui/menu/focusAfterMenu';
import menuStyles from '../../../ui/menu/Menu.module.css';
import { MenuChoice } from '../../../ui/menu/MenuChoice';
import { COMMENTS_ORDERS, commentsOrderTip, type CommentsOrder, type FoldedFiles, type foldAllEntry } from './commentsPanel';
import styles from './ReviewCommentsPanel.module.css';

const ORDER_ICONS: Record<CommentsOrder, Icon> = { newest: ArrowDownWideNarrow, oldest: ArrowUpNarrowWide, code: ListOrdered };

/**
 * How the Comments panel orders its comments, a small button by its arrows showing the order chosen: newest or oldest
 * first, or the code's order, grouped by file, whose files it can collapse or expand all at once. Kept for every review (`useReviewCommentsStore`); as every view menu, a
 * choice applies with the menu open, the list behind it showing it.
 */
interface CommentsOrderMenuProps {
  order: CommentsOrder;
  onChange: (order: CommentsOrder) => void;
  /** Grouped by file: every file folded or unfolded at once (`foldAllEntry`). */
  foldAll: ReturnType<typeof foldAllEntry>;
  onFold: (folded: FoldedFiles) => void;
}

export function CommentsOrderMenu({ order, onChange, foldAll, onFold }: CommentsOrderMenuProps) {
  const OrderIcon = ORDER_ICONS[order];
  const { tip, sub } = commentsOrderTip(order);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="small" icon={<OrderIcon size={14} />} aria-label={tip} data-tip={tip} data-tip-sub={sub} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={`${menuStyles.content} ${styles.orderMenu}`} align="end" sideOffset={4} onCloseAutoFocus={(event) => focusAfterMenu(event)}>
          <DropdownMenu.RadioGroup value={order} onValueChange={(value) => onChange(value as CommentsOrder)}>
            {COMMENTS_ORDERS.map(({ value, label }) => (
              <MenuChoice key={value} value={value} icon={ORDER_ICONS[value]} label={label} checked={value === order} />
            ))}
          </DropdownMenu.RadioGroup>
          {foldAll && (
            <>
              <DropdownMenu.Separator className={menuStyles.separator} />
              <DropdownMenu.Item className={menuStyles.item} onSelect={() => onFold(foldAll.folded)}>
                <span className={menuStyles.icon}>{foldAll.collapses ? <ChevronsDownUp size={14} /> : <ChevronsUpDown size={14} />}</span>
                <span className={menuStyles.label}>{foldAll.label}</span>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
