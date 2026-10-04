import { IonSearchbar } from '@ionic/react';

export type SearchFieldProps = {
  label: string;
  value?: string;
  placeholder?: string;
  debounceMs?: number;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

export function SearchField({
  label,
  value,
  placeholder,
  debounceMs = 250,
  disabled,
  onValueChange,
}: SearchFieldProps) {
  return (
    <IonSearchbar
      aria-label={label}
      className="ui-search"
      debounce={debounceMs}
      disabled={disabled}
      placeholder={placeholder}
      value={value}
      onIonInput={(event) => onValueChange?.(event.detail.value ?? '')}
    />
  );
}
