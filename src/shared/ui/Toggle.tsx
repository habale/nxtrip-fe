import { IonToggle } from '@ionic/react';

export type ToggleProps = {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  helperText?: string;
  onCheckedChange?: (checked: boolean) => void;
};

export function Toggle({
  label,
  checked,
  disabled,
  helperText,
  onCheckedChange,
}: ToggleProps) {
  return (
    <IonToggle
      alignment="center"
      checked={checked}
      disabled={disabled}
      helperText={helperText}
      justify="space-between"
      labelPlacement="start"
      onIonChange={(event) => onCheckedChange?.(event.detail.checked)}
    >
      {label}
    </IonToggle>
  );
}
