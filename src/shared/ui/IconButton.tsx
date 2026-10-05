import { IonButton } from '@ionic/react';

import { Icon, type IconName } from './Icon';

export type IconButtonProps = {
  icon: IconName;
  label: string;
  variant?: 'primary' | 'quiet' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  onClick?: () => void;
};

const appearanceByVariant = {
  primary: { color: 'primary', fill: 'solid' },
  quiet: { color: 'primary', fill: 'clear' },
  danger: { color: 'danger', fill: 'clear' },
} as const;

export function IconButton({
  icon,
  label,
  variant = 'quiet',
  size = 'medium',
  disabled,
  onClick,
}: IconButtonProps) {
  const appearance = appearanceByVariant[variant];

  return (
    <IonButton
      aria-label={label}
      className={`ui-icon-button ui-icon-button--${size}`}
      color={appearance.color}
      disabled={disabled}
      fill={appearance.fill}
      onClick={onClick}
    >
      <Icon name={icon} size={size} />
      <span className="sr-only">{label}</span>
    </IonButton>
  );
}
