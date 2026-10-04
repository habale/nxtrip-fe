import { IonSpinner } from '@ionic/react';

export type SpinnerProps = {
  label: string;
  size?: 'small' | 'medium' | 'large';
};

export function Spinner({ label, size = 'medium' }: SpinnerProps) {
  return (
    <span className={`ui-spinner ui-spinner--${size}`} role="status">
      <IonSpinner name="crescent" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
