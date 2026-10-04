import { IonSelect, IonSelectOption } from '@ionic/react';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = {
  label: string;
  options: SelectOption[];
  value?: string | string[];
  placeholder?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  errorText?: string;
  onValueChange?: (value: string | string[]) => void;
};

export function Select({
  label,
  options,
  value,
  placeholder,
  multiple = false,
  required,
  disabled,
  helperText,
  errorText,
  onValueChange,
}: SelectProps) {
  return (
    <IonSelect
      aria-invalid={Boolean(errorText)}
      className="ui-select"
      disabled={disabled}
      errorText={errorText}
      fill="outline"
      helperText={helperText}
      interface="popover"
      label={label}
      labelPlacement="stacked"
      multiple={multiple}
      placeholder={placeholder}
      required={required}
      value={value}
      onIonChange={(event) =>
        onValueChange?.(event.detail.value as string | string[])
      }
    >
      {options.map((option) => (
        <IonSelectOption
          key={option.value}
          disabled={option.disabled}
          value={option.value}
        >
          {option.label}
        </IonSelectOption>
      ))}
    </IonSelect>
  );
}
