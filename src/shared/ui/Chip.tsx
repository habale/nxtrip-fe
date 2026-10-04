import { IonChip, IonLabel } from '@ionic/react';

export type ChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function Chip({ label, selected, disabled, onClick }: ChipProps) {
  return (
    <IonChip
      aria-pressed={onClick ? selected : undefined}
      color={selected ? 'primary' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <IonLabel>{label}</IonLabel>
    </IonChip>
  );
}
