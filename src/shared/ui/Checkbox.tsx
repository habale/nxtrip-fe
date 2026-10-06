import { IonCheckbox } from '@ionic/react';

export type CheckboxProps = {
  label?: string;
  ariaLabel?: string;
  checked?: boolean;
  disabled?: boolean;
  helperText?: string;
  errorText?: string;
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({
  label,
  ariaLabel,
  checked,
  disabled,
  helperText,
  errorText,
  onCheckedChange,
}: CheckboxProps) {
  return (
    <IonCheckbox
      aria-label={ariaLabel}
      alignment="center"
      checked={checked}
      disabled={disabled}
      errorText={errorText}
      helperText={helperText}
      justify="space-between"
      labelPlacement="start"
      onIonChange={(event) => onCheckedChange?.(event.detail.checked)}
    >
      {label ?? null}
    </IonCheckbox>
  );
}
