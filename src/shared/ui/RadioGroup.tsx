import { IonRadio, IonRadioGroup } from '@ionic/react';

export type RadioOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type RadioGroupProps = {
  label: string;
  options: RadioOption[];
  value?: string;
  onValueChange?: (value: string) => void;
};

export function RadioGroup({
  label,
  options,
  value,
  onValueChange,
}: RadioGroupProps) {
  return (
    <fieldset className="ui-radio-group">
      <legend>{label}</legend>
      <IonRadioGroup
        value={value}
        onIonChange={(event) => onValueChange?.(event.detail.value as string)}
      >
        {options.map((option) => (
          <IonRadio
            key={option.value}
            disabled={option.disabled}
            justify="space-between"
            labelPlacement="start"
            value={option.value}
          >
            {option.label}
          </IonRadio>
        ))}
      </IonRadioGroup>
    </fieldset>
  );
}
