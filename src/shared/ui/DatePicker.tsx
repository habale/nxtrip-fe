import { IonDatetime } from '@ionic/react';

export type DatePickerPresentation =
  'date' | 'time' | 'date-time' | 'month-year';

export type DatePickerProps = {
  label: string;
  value?: string;
  min?: string;
  max?: string;
  presentation?: DatePickerPresentation;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
};

const ionicPresentation = {
  date: 'date',
  time: 'time',
  'date-time': 'date-time',
  'month-year': 'month-year',
} as const;

export function DatePicker({
  label,
  value,
  min,
  max,
  presentation = 'date',
  disabled,
  onValueChange,
}: DatePickerProps) {
  return (
    <section className="ui-date-picker" aria-label={label}>
      <IonDatetime
        disabled={disabled}
        max={max}
        min={min}
        presentation={ionicPresentation[presentation]}
        value={value}
        onIonChange={(event) => {
          const nextValue = event.detail.value;
          if (typeof nextValue === 'string') {
            onValueChange?.(nextValue);
          }
        }}
      />
    </section>
  );
}
