import { IonTextarea } from '@ionic/react';

export type TextAreaProps = {
  label: string;
  value?: string;
  name?: string;
  placeholder?: string;
  rows?: number;
  maxlength?: number;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  helperText?: string;
  errorText?: string;
  onValueChange?: (value: string) => void;
};

export function TextArea({
  label,
  value,
  name,
  placeholder,
  rows = 4,
  maxlength,
  required,
  disabled,
  readonly,
  helperText,
  errorText,
  onValueChange,
}: TextAreaProps) {
  return (
    <IonTextarea
      aria-invalid={Boolean(errorText)}
      autoGrow
      className="ui-textarea"
      disabled={disabled}
      errorText={errorText}
      fill="outline"
      helperText={helperText}
      label={label}
      labelPlacement="stacked"
      maxlength={maxlength}
      name={name}
      placeholder={placeholder}
      readonly={readonly}
      required={required}
      rows={rows}
      value={value}
      onIonInput={(event) => onValueChange?.(event.detail.value ?? '')}
    />
  );
}
