import { IonInput } from '@ionic/react';

export type TextInputProps = {
  label: string;
  value?: string;
  name?: string;
  placeholder?: string;
  maxlength?: number;
  type?:
    | 'date'
    | 'text'
    | 'email'
    | 'number'
    | 'password'
    | 'search'
    | 'tel'
    | 'time'
    | 'url';
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
  const temporal = type === 'date' || type === 'time';
  const input = (
    <IonInput
      aria-label={temporal ? label : undefined}
      aria-invalid={Boolean(errorText)}
      autocomplete={autocomplete}
      className={`ui-input${temporal ? ' ui-input--temporal' : ''}`}
      disabled={disabled}
      errorText={errorText}
      fill="outline"
      helperText={helperText}
      inputMode={inputMode}
      label={temporal ? undefined : label}
      labelPlacement={temporal ? undefined : 'stacked'}
      maxlength={maxlength}
      mode="md"
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

  if (!temporal) return input;

  return (
    <div className="ui-temporal-field">
      <span className="ui-temporal-field__label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {input}
    </div>
  );
}
