import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';
import { Kbd } from './Kbd';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactElement;
}

export function Tooltip({ content, shortcut, side = 'bottom', children }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content className={styles.tooltip} side={side} sideOffset={6}>
          {content}
          {shortcut && <Kbd keys={shortcut} />}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export const TooltipProvider = RadixTooltip.Provider;
