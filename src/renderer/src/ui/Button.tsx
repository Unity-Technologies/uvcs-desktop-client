import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { classNames } from '../lib/classNames';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'medium', icon, loading = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const classes = classNames(styles.button, styles[variant], size !== 'medium' && styles[size], !children && styles.iconOnly, className);

  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className={styles.spinner} /> : icon}
      {children}
    </button>
  );
});
