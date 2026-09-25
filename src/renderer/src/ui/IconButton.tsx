import { forwardRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';
import { Tooltip } from './Tooltip';

interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon'> {
  icon: ReactNode;
  label: string;
  shortcut?: string;
}

/** A compact, icon-only button that explains itself with a tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, shortcut, variant = 'ghost', ...rest },
  ref,
) {
  return (
    <Tooltip content={label} shortcut={shortcut}>
      <Button ref={ref} variant={variant} icon={icon} aria-label={label} {...rest} />
    </Tooltip>
  );
});
