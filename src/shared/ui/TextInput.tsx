import { IonInput } from '@ionic/react';

export type TextInputProps = {
  label: string;
  value?: string;
  name?: string;
  placeholder?: string;
  maxlength?: number;
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
  inputMode?:
    'text' | 'email' | 'numeric' | 'decimal' | 'search' | 'tel' | 'url';
  autocomplete?:
    | 'off'
    | 'on'
    | 'name'
    | 'email'
    | 'username'
    | 'current-password'
    | 'new-password'
    | 'one-time-code'
    | 'tel'
    | 'url'
    | 'street-address'
    | 'postal-code'
    | 'country-name'
    | 'organization'
    | 'cc-number';
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  helperText?: string;
  errorText?: string;
  onValueChange?: (value: string) => void;
  onBlur?: () => void;
};

export function TextInput({
  label,
  value,
  name,
  placeholder,
  maxlength,
  type = 'text',
  inputMode,
  autocomplete,
  required,
  disabled,
  readonly,
  helperText,
  errorText,
  onValueChange,
  onBlur,
}: TextInputProps) {
  return (
    <IonInput
      aria-invalid={Boolean(errorText)}
      autocomplete={autocomplete}
      className="ui-input"
      disabled={disabled}
      errorText={errorText}
      fill="outline"
      helperText={helperText}
      inputMode={inputMode}
      label={label}
      labelPlacement="stacked"
      maxlength={maxlength}
      name={name}
      placeholder={placeholder}
      readonly={readonly}
      required={required}
      type={type}
      value={value}
      onIonBlur={onBlur}
      onIonInput={(event) => onValueChange?.(event.detail.value ?? '')}
    />
  );
}
