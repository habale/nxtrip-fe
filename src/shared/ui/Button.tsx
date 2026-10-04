import { IonButton } from '@ionic/react';
import type { PropsWithChildren } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'small' | 'medium' | 'large';

export type ButtonProps = PropsWithChildren<{
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  href?: string;
  navigationDirection?: 'forward' | 'back' | 'root';
  ariaLabel?: string;
  onClick?: () => void;
}>;

const appearanceByVariant = {
  primary: { color: 'primary', fill: 'solid' },
  secondary: { color: 'secondary', fill: 'solid' },
  quiet: { color: 'primary', fill: 'clear' },
  danger: { color: 'danger', fill: 'solid' },
} as const;

export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  block = false,
  disabled = false,
  loading = false,
  type = 'button',
  href,
  navigationDirection,
  ariaLabel,
  onClick,
}: ButtonProps) {
  const appearance = appearanceByVariant[variant];

  return (
    <IonButton
      aria-label={ariaLabel}
      className="ui-button"
      color={appearance.color}
      disabled={disabled || loading}
      expand={block ? 'block' : undefined}
      fill={appearance.fill}
      routerDirection={navigationDirection}
      routerLink={href}
      size={size === 'medium' ? 'default' : size}
      type={type}
      onClick={onClick}
    >
      {loading ? <span aria-live="polite">…</span> : children}
    </IonButton>
  );
}
