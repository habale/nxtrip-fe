import { useState } from 'react';

import { getAmountSuggestions } from './amount-input-suggestions';
import { TextInput } from './TextInput';

export type AmountInputProps = {
  label: string;
  value: string;
  decimalPlaces: number;
  locale: string;
  disabled?: boolean;
  required?: boolean;
  onValueChange: (value: string) => void;
  suggestionLabel: (amount: string) => string;
};

export function AmountInput({
  label,
  value,
  decimalPlaces,
  locale,
  disabled,
  required,
  onValueChange,
  suggestionLabel,
}: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  const suggestions = getAmountSuggestions(value, decimalPlaces);
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  return (
    <div className="ui-amount-input">
      <TextInput
        label={label}
        type="number"
        inputMode="decimal"
        value={value}
        required={required}
        disabled={disabled}
        onValueChange={onValueChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {focused && suggestions.length > 0 && !disabled && (
        <div className="ui-amount-input__suggestions">
          {suggestions.map((amount) => {
            const formattedAmount = formatter.format(amount);
            return (
              <button
                key={amount}
                type="button"
                aria-label={suggestionLabel(formattedAmount)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => onValueChange(String(amount))}
              >
                {formattedAmount}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
