import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getAmountSuggestions } from './amount-input-suggestions';
import { TextInput } from './TextInput';

export type AmountInputProps = {
  label: string;
  value: string;
  decimalPlaces: number;
  locale: string;
  disabled?: boolean;
  required?: boolean;
  suggestionsEnabled?: boolean;
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
  suggestionsEnabled = true,
  onValueChange,
  suggestionLabel,
}: AmountInputProps) {
  const [focused, setFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const viewportHeightBeforeFocus = useRef(
    Math.min(
      window.innerHeight,
      window.visualViewport?.height ?? window.innerHeight,
    ),
  );
  const suggestions = getAmountSuggestions(value, decimalPlaces);
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });

  useEffect(() => {
    if (!focused || !suggestionsEnabled) return;

    const updateKeyboardInset = () => {
      const viewport = window.visualViewport;
      const visibleHeight = Math.min(
        window.innerHeight,
        viewport?.height ?? window.innerHeight,
      );
      const heightReduction = viewportHeightBeforeFocus.current - visibleHeight;

      setKeyboardVisible(heightReduction > 100);
      if (!viewport) {
        setKeyboardInset(0);
        return;
      }

      setKeyboardInset(
        Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
      );
    };

    updateKeyboardInset();
    window.visualViewport?.addEventListener('resize', updateKeyboardInset);
    window.visualViewport?.addEventListener('scroll', updateKeyboardInset);
    window.addEventListener('resize', updateKeyboardInset);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardInset);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardInset);
      window.removeEventListener('resize', updateKeyboardInset);
      setKeyboardVisible(false);
    };
  }, [focused, suggestionsEnabled]);

  return (
    <div className="ui-amount-input">
      <TextInput
        label={label}
        type="number"
        inputMode="decimal"
        autocomplete="transaction-amount"
        value={value}
        required={required}
        disabled={disabled}
        onValueChange={onValueChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {focused &&
        suggestionsEnabled &&
        keyboardVisible &&
        suggestions.length > 0 &&
        !disabled &&
        createPortal(
          <div
            className="ui-amount-input__suggestions"
            role="toolbar"
            style={{ bottom: `${keyboardInset}px` }}
          >
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
          </div>,
          document.body,
        )}
    </div>
  );
}
