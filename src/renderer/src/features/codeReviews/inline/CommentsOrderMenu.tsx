import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Check, ListOrdered } from 'lucide-react';
import type { Icon } from '../../../lib/actions';
import { Button } from '../../../ui/Button';
import { focusAfterMenu } from '../../../ui/menu/focusAfterMenu';
import menuStyles from '../../../ui/menu/Menu.module.css';
import { COMMENTS_ORDERS, commentsOrderTip, type CommentsOrder } from './commentsPanel';
import styles from './ReviewCommentsPanel.module.css';

const ORDER_ICONS: Record<CommentsOrder, Icon> = { newest: ArrowDownWideNarrow, oldest: ArrowUpNarrowWide, code: ListOrdered };

/**
 * How the Comments panel orders its comments, a small button by its arrows showing the order chosen: newest or oldest
 * first, or the code's order, grouped by file. Kept for every review (`useReviewCommentsStore`).
 */
export function CommentsOrderMenu({ order, onChange }: { order: CommentsOrder; onChange: (order: CommentsOrder) => void }) {
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
            {COMMENTS_ORDERS.map(({ value, label }) => {
              const ChoiceIcon = ORDER_ICONS[value];
              return (
                <DropdownMenu.RadioItem key={value} className={menuStyles.item} value={value}>
                  <span className={menuStyles.icon}>
                    <ChoiceIcon size={14} />
                  </span>
                  <span className={menuStyles.label}>{label}</span>
                  <span className={menuStyles.check}>
                    <Check size={14} className={value === order ? undefined : styles.unchecked} />
                  </span>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
